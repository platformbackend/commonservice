const jwt = require('jsonwebtoken')
const { findOne, findOneCache } = require('new-dynamo-wrapper')
const { context } = require(global.CONTEXTFILEPATH)
// zip -r9 layers.zip ./

exports.authorizerFunc = async (token) => {
	try {
		console.log('Authorizer invoked Version 2', token)
		return await jwt.verify(token, '9lqYbPR6p2rB', async (err, decoded) => {

			if (err) {
				console.log('Error from Authorizer', err, token)
				if (err.name === 'TokenExpiredError') {
					console.log('Token expired error')
					return { error: { message: err.message || 'TOKEN EXPIRED', statusCode: 501 } }
				} else if (err.message === 'jwt expired') return { error: { message: 'Session expired', statusCode: 501 } }
				return { error: { message: err.message || 'INVALID TOKEN', statusCode: 500 } }
			}

			if (decoded) {
				console.log('Decoded', decoded?._id, decoded?.screenName)
				let tableName = 'user_authentication'
				let store = context?.getStore()
				if(!store?.common) store = {common:{}}
				if (!decoded.networkOp) {
					
					store.common.networkOp = 'rummy'
					decoded.networkOp = 'rummy'
					
				}
				else {
					store.common.networkOp = decoded.networkOp
				}
				store.common.screenName = decoded.screenName ?? ''
				
				let authData = await findOne(tableName, { _id: decoded._id })
				if (!authData) {
					console.log('No Auth data found')
					return { error: { message: 'Session expired', statusCode: 501 } }
				}


				// For sigle Token access code, uncomment in the production
				if (authData?.token !== token) {
					console.log(decoded.screenName, 'Token Missmatch', 'Token in Auth table', authData?.token, 'Token in Request', token)
					if (decoded.channel === 'WTIPS' || decoded.channel === 'IPS') {
						return { error: { message: 'Session expired.', statusCode: 501, channel: decoded.channel } }

					}
					return { error: { message: 'Session expired.', statusCode: 501 } }
				}


				if (authData) {
					if (decoded.device_id !== authData.device_id) {
						console.log(decoded.screenName, 'device id missmatch, Token DeviceID', decoded.device_id, 'AuthTable DeviceID', authData.device_id)
						return { error: { message: 'If logged in from multiple devices, please logout from all devices and login', statusCode: 1001 } }
					}
				}
				if (authData && authData.blockedForLogin) {
					console.log(decoded.screenName, 'blockedForLogin', authData.blockedForLogin)
					return { error: { message: 'User Account Is Blocked or Invalid. Please Contact Support Team', statusCode: 1002 } }
				}

				console.log(decoded.screenName, 'user token authenticated, sending decoded to resolver')
				return decoded
			}

		})

	} catch (error) {
		console.log('error', error.message)
		return error
	}
}