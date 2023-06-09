require("dotenv").config();
const db = require("../utils/db");
const sha3 = require("../utils/sha3").muonSha3;
const NodeCache = require("node-cache");
const MuonFeeABI = require('../config/abis/MuonFeeUpgradeable.json');
const MuonFeeAddress = process.env.MUON_FEE_CONTRACT;
// cache for 1 minute
const cache = new NodeCache({ stdTTL: 60 });

const Web3 = require("web3");
const web3 = new Web3(process.env.WEB3_PROVIDER);

const amount = web3.utils.toWei("1");
const timestampWindow = 5 * 60 * 1000; // 5 minutes

// TODO: load from contract
const REQUESTS_PER_WALLET = 10;

const MuonFeeContract = new web3.eth.Contract(
  MuonFeeABI, MuonFeeAddress);

const getChainBalance = async(wallet) => {
  let user = await MuonFeeContract.methods.users(wallet).call();
  return user;
}

const hasEnoughFee = async (spender, app) => {
  let collection = await db.get("requests");
  let reqs = await collection.count({spender: spender.toLowerCase()});
  console.log(reqs, "reqs");

  //TODO: use BN for calculations
  let usedFees = amount * reqs;
  console.log(usedFees, "usedFees")

  // we assume that users can't withdraw the fees
  // and cached balance is always valid
  let cacheKey = `balance:${spender}`;
  let cachedBalance = await app.redis.get(cacheKey);
  console.log('cachedBalance, usedFees', cachedBalance, usedFees);
  if(cachedBalance && usedFees < cachedBalance){
    return true;
  }

  let chainBalance = await getChainBalance(spender);

  await app.redis.set(cacheKey, chainBalance);
  return usedFees < chainBalance;
}

// TODO: handle non-EVM chains
module.exports = (app) => {
  app.post(`/sign`, async function(req, res, next) {
    let { request, spender, appId, sign, timestamp } = req.body;

    // validate timestamp
    let now = Date.now();
    if (now - timestamp > timestampWindow || now - timestamp < 0) {
      return res.send({
        success: false,
        error: "Timestamp is not valid.",
      }).status(400);
    }

    // verify sign
    console.log(spender, timestamp, appId);
    let userHash = sha3(
      {type: "address", value: spender},
      {type: "uint64", value: timestamp},
      {type: "uint256", value: appId}
    );
    let signerUser = web3.eth.accounts.recover(userHash, sign);
    if(signerUser != spender){
      return res.send({
        success: false,
        error: "Invalid Signature.",
      }).status(400);
    }

    let hash = sha3(
      { type: "uint256", value: request },
      { type: "uint256", value: amount.toString() }
    );

    // check fee balance
    let checkBalance = await hasEnoughFee(spender, app);
    if(!checkBalance){
      return res.send({
        success: false,
        error: "Insufficient fee amount",
      }).status(400);
    }

    // save into the db
    let data = {
      // user hash should be unique.
      // each user can send one request per second to
      // a specific app
      _id: userHash,
      reqId: request,
      //TODO: create Mongo index for spender
      spender: spender.toLowerCase(),
      amount: amount.toString(),
      sign,
      timestamp,
      appId
    };
    let collection = await db.get("requests");
    console.log(`Saving ${data._id}`)
    await collection.insertOne(data);

    res.send({
      sign: web3.eth.accounts.sign(hash, process.env.SIGNER_PK).signature,
      amount: amount.toString(),
      success: true,
    });
  });
};
