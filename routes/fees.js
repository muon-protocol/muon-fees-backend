require("dotenv").config();
const db = require("../utils/db");
const sha3 = require('../utils/sha3').muonSha3;
const NodeCache = require("node-cache");

// cache for 1 minute
const cache = new NodeCache({ stdTTL: 60 });

const Web3 = require("web3");
const web3 = new Web3(process.env.WEB3_PROVIDER);

const amount = web3.utils.toWei("1");

module.exports = (app) => {
  app.post(`/sign`, function(req, res, next) {
    console.log(req.body, req.data, "body")
    let {request, spedner, appId, sign, timestamp} = req.body;
    // TODO: validate timestamp
    // TODO: verify sign

    // TODO: validate request

    let hash = sha3(
      {type: "uint256", value: request},
      {type: "uint256", value: amount.toString()},
    );

    res.send({
      sign: web3.eth.accounts.sign(hash, process.env.SIGNER_PK).signature,
      amount: amount.toString(),
      success: true
    });
  });
};
