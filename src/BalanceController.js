const BN = require("bn.js");
const db = require("../utils/db");

exports.getUsedBalance = async function (spender) {
    spender = spender.toLowerCase();
    let collection = await db.get("requests");
    let requests = await collection.find({spender}).toArray();
    console.log(requests);
    const totalAmount = requests.reduce((acc, request) => acc.add(new BN(request.amount)), new BN(0));
    return totalAmount.toString();
};