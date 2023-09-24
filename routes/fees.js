require("dotenv").config();
const db = require("../utils/db");
const sigUtil = require("@metamask/eth-sig-util");
const sha3 = require("../utils/sha3").muonSha3;
const asyncErrorHandler = require("../utils/errorHandler").asyncErrorHandler;
const NodeCache = require("node-cache");
const MuonFeeABI = require('../config/abis/MuonFeeUpgradeable.json');
const configContracts = require("../config/contracts.json");
const BalanceController = require("../src/BalanceController");
const BN = require("bn.js");
// cache for 1 minute
const cache = new NodeCache({stdTTL: 60});

const Web3 = require("web3");
const web3 = new Web3(process.env.WEB3_PROVIDER);

const amount = new BN(web3.utils.toWei("1"));
const timestampWindow = 5 * 60 * 1000; // 5 minutes

// TODO: load from contract
const REQUESTS_PER_WALLET = 10;


let feeContracts = [];
for (let i = 0; i < configContracts.length; i++) {
    let configContract = configContracts[i];
    const web3Obj = new Web3(configContract.rpc);
    feeContracts.push(new web3Obj.eth.Contract(MuonFeeABI, configContract.contract));
}


const getChainBalance = async (wallet) => {
    let promises = [];
    for (let i = 0; i < feeContracts.length; i++) {
        const feeContract = feeContracts[i];
        const balanceReq = feeContract.methods.users(wallet).call();
        promises.push(balanceReq);
    }
    const totalBalance = await Promise.all(promises)
        .then(results => {
            let totalBalance = new BN(0);
            results.forEach(result => {
                totalBalance = totalBalance.add(new BN(result))
            });
            return totalBalance;
        });
    return totalBalance;
};


const hasEnoughFee = async (spender, app) => {
    let collection = await db.get("requests");
    let reqs = await collection.count({spender: spender.toLowerCase()});

    let usedFees = amount.muln(reqs);

    // we assume that users can't withdraw the fees
    // and cached balance is always valid
    let cacheKey = `balance:${spender}`;
    let cachedBalance = await app.redis.get(cacheKey);
    cachedBalance = new BN(cachedBalance ? cachedBalance : 0);
    console.log('cachedBalance, usedFees', cachedBalance.toString(), usedFees.toString());
    if (usedFees.lt(cachedBalance)) {
        return true;
    }

    let chainBalance = await getChainBalance(spender);

    await app.redis.set(cacheKey, chainBalance.toString());
    return usedFees.lt(chainBalance);
}

// TODO: handle non-EVM chains
module.exports = (app) => {
    app.post(`/sign`, async function (req, res, next) {
        let {request, spender, appId, sign, timestamp} = req.body;
        spender = spender.toLowerCase();


        // validate timestamp
        let now = Date.now();
        if (now - timestamp > timestampWindow || now - timestamp < 0) {
            return res.send({
                success: false,
                error: "Timestamp is not valid.",
            }).status(400);
        }

        let collection = await db.get("requests");
        let duplicateRequest = await collection.findOne({sign: sign});
        if (duplicateRequest)
            return res.send({
                success: false,
                error: "Duplicate signature",
            }).status(400);

        // verify sign

        const eip712TypedData = {
            types: {
                EIP712Domain: [{name: 'name', type: 'string'}],
                Message: [
                    {type: 'address', name: 'address'},
                    {type: 'uint64', name: 'timestamp'},
                    {type: 'uint256', name: 'appId'},
                ]
            },
            domain: {name: 'Muonize'},
            primaryType: 'Message',
            message: {address: spender, timestamp: timestamp, appId}
        };
        let recoveredAddress = sigUtil.recoverTypedSignature({
            data: eip712TypedData,
            signature: sign,
            version: sigUtil.SignTypedDataVersion.V4
        });
        recoveredAddress = recoveredAddress.toLowerCase();


        if (recoveredAddress != spender) {
            return res.send({
                success: false,
                error: "Invalid Signature.",
            }).status(400);
        }

        let requestHash = sha3(
            {type: "address", value: spender},
            {type: "uint64", value: timestamp},
            {type: "uint256", value: appId}
        );


        let hash = sha3(
            {type: "uint256", value: request},
            {type: "uint256", value: amount.toString()}
        );

        // check fee balance
        let checkBalance = await hasEnoughFee(spender, app);
        if (!checkBalance) {
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
            _id: requestHash,
            reqId: request,
            //TODO: create Mongo index for spender
            spender: spender.toLowerCase(),
            amount: amount.toString(),
            sign,
            timestamp,
            appId
        };
        await collection.insertOne(data);

        res.send({
            sign: web3.eth.accounts.sign(hash, process.env.SIGNER_PK).signature,
            amount: amount.toString(),
            success: true,
        });
    });
    app.all(`/get-used-balance`, asyncErrorHandler(async function (req, res, next) {
        let spender = req.body.spender;
        if (!spender)
            return res.status(400).send({success: false, message: "Please send spender"});
        let usedBalance = await BalanceController.getUsedBalance(spender);
        return res.send({success: true, usedBalance});
    }));

};
