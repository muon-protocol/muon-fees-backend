require("dotenv").config();
const db = require("../utils/db");
const sha3 = require("../utils/sha3").muonSha3;
const NodeCache = require("node-cache");

// cache for 1 minute
const cache = new NodeCache({ stdTTL: 60 });

const Web3 = require("web3");
const web3 = new Web3(process.env.WEB3_PROVIDER);

const amount = web3.utils.toWei("1");
const timestampWindow = 5 * 60; // 5 minutes

// TODO: handle non-EVM chains
module.exports = (app) => {
  app.post(`/sign`, function(req, res, next) {
    // console.log(req.body, req.data, "body");
    let { request, spender, appId, sign, timestamp } = req.body;

    // validate timestamp
    let now = Math.floor(Date.now() / 1000);
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

    // TODO: save into db

    res.send({
      sign: web3.eth.accounts.sign(hash, process.env.SIGNER_PK).signature,
      amount: amount.toString(),
      success: true,
    });
  });
};
