const { getNetworkFromContext } = require(global.CONTEXTFILEPATH) // Renamed from getNetworkFromContext as per previous example
const { findOneCache } = require('new-dynamo-wrapper')
exports.getEnv = (envVariableName) => {
	const networkOp = getNetworkFromContext()

	return this.getEnvWithOp(networkOp, envVariableName)
}

exports.getEnvWithOp = (networkOp, envVariableName) => {

	console.log(`getEnvironmentWithOp called with networkOp: ${networkOp}, final envVariableName: ${envVariableName}`)
	return process.env[envVariableName]
}

exports.extractNetworkOp_Channel = async (channel) => {
	
	//I have converted this to async function. Beware!!!!
	let networkOp = 'rummy'

	console.log('extractNetworkOp_Channel call - returning networkOp for channel:', channel, 'networkOp:', networkOp)
	return networkOp
}



