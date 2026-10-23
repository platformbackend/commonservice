const { makeGotCallValidation } = require('../utils/requestValidation')

/**	
 * Function for sending the got call with retry
 * @param {object} params										object being sent to the function
 * @param {string} params.screenName				screenName of the user
 * @param {string} params.sourceFunc				function from where the call is done
 * @param {string} params.protocol					protocol being sent
 * @param {string} params.url								protocol url
 * @param {object} params.data							the data object
 * @param {object} params.reqHeaders				request headers (if any)
 * @param {number} params.retryLimit				number of retries
 * @param {number} params.timeout						timeout for the call
 * 
 * @returns {Promise}
 **/
exports.makeGotCall = async (params) => {
	try {
		await makeGotCallValidation(params)
		let { screenName, sourceFunc, protocol, url, data, reqHeaders, retryLimit, timeout } = params

		reqHeaders = reqHeaders || {}

		let got = await import('got')				// dynamic import of got
		let retryObj = {}
		got = got.default

		if (retryLimit > 0) {
			retryObj = {
				limit: retryLimit,
				methods: ['GET', 'POST'],
				calculateDelay: ({ attemptCount }) => {
					console.log(screenName, sourceFunc, protocol, 'attempt', attemptCount)
					if (attemptCount < (retryLimit + 1)) return 10
					else return 0
				}
			}
		}
		console.log('Alert UnwantedCall data ', protocol)
		if (protocol == 'mixPanel') {
			return got.post(url, { json: data, headers: reqHeaders, retry: retryObj, timeout: { request: timeout } })
				.then((resp) => resp)
				.catch((error) => { console.log('screenName:', screenName, 'protocol:', protocol, 'got call failed retryLimit:', retryLimit, 'timeout:', timeout); throw error })
		}

		return got.post(url, { json: data, headers: reqHeaders, retry: retryObj, timeout: { request: timeout } })
			.json()
			.then((resp) => resp)
			.catch((error) => { console.log('screenName:', screenName, 'protocol:', protocol, 'got call failed retryLimit:', retryLimit, 'timeout:', timeout); throw error })

	} catch (error) {
		console.error(params.screenName, params.sourceFunc, params.protocol, 'error in makeGotCall:', error.message)
		return { error: { message: error.message, status: error.code } }
	}
}