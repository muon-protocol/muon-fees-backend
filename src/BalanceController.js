const db = require("../utils/db");

exports.getUsedBalance = async function (spender) {
    spender = spender.toLowerCase();
    let collection = await db.get("requests");
    let requests = await collection.find({spender}).toArray();
    console.log(requests);
    const totalAmount = requests.reduce((acc, request) => acc + request.amount, 0);
    return totalAmount;
};