require("dotenv").config();
const db = require("../utils/db");
const sha3 = require("../utils/sha3").muonSha3;
const NodeCache = require("node-cache");

// cache for 1 minute
const cache = new NodeCache({ stdTTL: 60 });

const Web3 = require("web3");
const web3 = new Web3(process.env.WEB3_PROVIDER);

const amount = web3.utils.toWei("1");
const timestampWindow = 5 * 60 * 1000; // 5 minutes

// TODO: load from contract
const REQUESTS_PER_WALLET = 10;

const hasEnoughFee = async (spender) => {
  let collection = await db.get("requests");
  let reqs = await collection.find({spender: spender.toLowerCase()}).toArray();
  console.log(reqs);
  return reqs.length <= REQUESTS_PER_WALLET;
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
    let checkBalance = await hasEnoughFee(spender);
    if(!checkBalance){
      return res.res.send({
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
