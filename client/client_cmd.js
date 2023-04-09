const axios = require("axios");
const endpoint = "http://localhost:3000/sign";
const sampleReqId =
	"0x7e374975d7edfd0fa379750821c97974af5e1100103307e63a069a2362378a89";
const sampleAppId =
	"45810160343022089601028851206408642627529628329831086458846511772841706178168";
const Web3 = require("web3");
const web3 = new Web3(process.env.WEB3_PROVIDER);

const spenderPK = process.argv[2];
const spender = web3.eth.accounts.privateKeyToAccount(spenderPK);

const { soliditySha3 } = require("../utils/sha3.js");

let timestamp = Math.floor(Date.now());

const hash = soliditySha3(
	{ type: "address", value: spender.address },
	{ type: "uint64", value: timestamp },
	{ type: "uint256", value: sampleAppId }
);

let sign = web3.eth.accounts.sign(hash, spender.privateKey);

axios
	.post(endpoint, {
		request: sampleReqId,
		spender: spender.address,
		timestamp: timestamp,
		appId: sampleAppId,
		sign: sign.signature,
	})
	.then(({ data }) => {
		console.log(data);
	});