const { findOneCache } = require('new-dynamo-wrapper')

/**
 * This function is the express handler for the IP whitelisting middleware.
 * 
 * @param {Request} request - The request object.
 * @param {Response} response - The response object.
 * @param {NextFunction} next - The next function.
 * 
 * @returns {Promise<void>} - A promise that resolves when the middleware is done.
 * 
 * @throws {Error} - If there is an error while checking the IP whitelist.
 * 
 * @description
 * This middleware checks if the request IP is in the whitelist for the path.
 * If the request IP is not in the whitelist, then it returns a 403 Forbidden response.
 * If the request IP is in the whitelist, then it calls the next middleware.
 * 
 **/
const handler = async (request, response, next) => {
	try {
		// Get the request IP and path
		// The request IP is set in the request object by the express middleware
		// The path is set in the request object by the express middleware
		const requestIp = request.ip
		const path = request.path

		// If the service name is not set, then skip the IP whitelisting
		if (!process.env.SERVICE_NAME) {
			console.log('SERVICE_NAME is not set, skipping IP whitelisting')
			next()
			return
		}

		// fetch the config for the whitelist for the path
		const whitelistConfig = await findOneCache('wt_config', { _id: process.env.SERVICE_NAME, s_key: 'ip-whitelisting' })

		// Get the config for the path
		const PATH_CONFIG = whitelistConfig?.[path] || {}

		// commonIPWhitelist is the common whitelist for all paths (internal IP addresses)
		// If the commonIPWhitelist is not set, then use an empty array
		const COMMON_WHITELISTED_IPS = whitelistConfig?.commonIPWhitelist || []

		// extra IPs are the extra IPs for the path
		// If the extraIPs are not set, then use an empty array
		const extraIPs = PATH_CONFIG.extraIPs || []

		// if the useCommonWhitelist is true, then use the common whitelist
		const WHITELISTED_IPS = PATH_CONFIG.useCommonWhitelist
			? [...COMMON_WHITELISTED_IPS, ...extraIPs]
			: extraIPs

		// Check if the request IP is in the whitelist
		const isWhitelisted = WHITELISTED_IPS.includes(requestIp)
		console.log(`Checking if request IP ${requestIp} is whitelisted for the path ${path}: ${isWhitelisted} in the list: ${WHITELISTED_IPS}`)

		// If the request IP is not in the whitelist, then return 403
		if (!isWhitelisted) {
			console.log(`Request IP ${requestIp} is not in the whitelist for the path ${path}`)
			return response.status(403).send({
				errorCode: 430,
				errorMessage: 'Forbidden',
			})
		}

		next()
	} catch (error) {
		next(error)
	}
}

module.exports = { handler }