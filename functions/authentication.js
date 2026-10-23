const { authorizerFunc } = require('./authorizerFunc')
const { context } = require(global.CONTEXTFILEPATH)
const { findOneCache } = require('new-dynamo-wrapper')
/**
 * This function is the express handler for the authentication middleware.
 *
 * @param {Request} request - The request object.
 * @param {Response} response - The response object.
 * @param {NextFunction} next - The next function.
 */
const handler = async (request, response, next) => {
	try {
		// This is the function that will be called to authorize the request
		const decoded = await authorizerFunc(request.header('Authorization'))

		if (decoded?.error) {
			response.statusCode = 403
			response.send(decoded.error)
		}

		if (!decoded?._id) {
			throw new Error('Authorization token missing')
		}
		// This is the decoded JWT token that will be available in the response.locals.authorizer
		response.locals.authorizer = decoded

		next()
	} catch (error) {
		next(error)
	}
}

const adminHandler = async (request, response, next) => {
	const store = context.getStore()
	store.common.networkOp = 'rummy'

	next()
}
const lobbyHandler = async (request, response, next) => {
	const store = context.getStore()
	store.common.networkOp = 'rummy'



	next()
}


const getSelectedLanguageFromContext = () => {
	return context.getStore()?.common?.selectedLanguage ?? 'en'
}

module.exports = {
	handler,
	adminHandler,
	lobbyHandler,
	getSelectedLanguageFromContext
}