require("dotenv").config();
const MongoClient = require("mongodb").MongoClient;
var db;

const connect = async () => {
  var client = await MongoClient.connect(process.env.MONGODB_CS);
  db = client.db(process.env.MONGODB_DB_NAME);
};

module.exports.get = async (collection) => {
  if (!db) {
    await connect();
  }
  return db.collection(collection);
};