require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const {createClient} = require("redis");

const PORT = process.env.SERVER_PORT || 3002;

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.redis = createClient({url: process.env.REDIS_URL});
(async () => {
  app.redis.on("error", (error) => console.error(`Redis: ${error}`));
  await app.redis.connect();
})();

app.use(express.json());
app.get("/", (req, res) => {
  res.json({ message: "Muon Fees API" });
});

require("./routes/fees.js")(app);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
