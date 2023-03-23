const jsSha3 = require('js-sha3');
const Web3 = require("web3");
const web3Instance = new Web3()

function soliditySha3(params) {
    return web3Instance.utils.soliditySha3(...params)
}

function muonSha3(...args) {
    const packed = web3Instance.utils.encodePacked(...args);
    if(!packed)
        throw `muonSha3 error: unknown input data`
  let buff = Buffer.from(packed.substring(2), 'hex');
  return '0x' + jsSha3.keccak_256(buff)
}

module.exports = {
	soliditySha3,
	muonSha3
}
