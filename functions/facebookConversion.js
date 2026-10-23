/* eslint-disable indent */
const { findOneCache } = require('new-dynamo-wrapper')
const crypto = require('crypto')
const utf8 = require('utf8')
const { makeGotCall } = require('./makeGotCall')

exports.facebookConversion = async (screenName, dataToCAPI, params, channel) => {
	try {
		console.log(screenName, 'Inside facebookConversion, params:', params, 'dataToCAPI:', dataToCAPI, 'channel:', channel)

		// Get fb config containing channelwise dashboard URLs and other settings
		let protocolsConfig = await findOneCache('settings', { _id: 'pf-sendProtocol-config', type: 'protocols' })
		let fbConfig = protocolsConfig.facebookConversionConfig

		// Hash the params which are required for user_data
		let hashedUserData = hashing(params?.email, params?.phone, params?.first_name, params?.city, params?.postal_code)
		if (params?.ip) hashedUserData['client_ip_address'] = params?.ip
		if (params?.advertising_id) hashedUserData['madid'] = params?.advertising_id
		if (params?.user_agent) hashedUserData['client_user_agent'] = params?.user_agent
		if (params?.fbc) hashedUserData['fbc'] = params?.fbc
		if (params?.fbp) hashedUserData['fbp'] = params?.fbp

		dataToCAPI[0].user_data = hashedUserData
		console.log(screenName, 'dataToCAPI =>', dataToCAPI)

		const url = getChannelUrl(channel, fbConfig)
		let resp
		if (process.env.NODE_ENV != 'production') {
			let event_test_code = await findOneCache('settings', { _id: 'fb-test-event-code', type: 'code' })
			resp = await makeGotCall(
				{
					screenName: screenName,
					sourceFunc: 'facebookConversion',
					protocol: 'FB Conversion',
					url: url,
					data: { 'data': dataToCAPI, 'test_event_code': event_test_code.value },
					reqHeaders: {},
					retryLimit: fbConfig.retries || 0,
					timeout: fbConfig.timeout || 1000
				}
			)
		}
		else {
			resp = await makeGotCall(
				{
					screenName: screenName,
					sourceFunc: 'facebookConversion',
					protocol: 'FB Conversion',
					url: url,
					data: { 'data': dataToCAPI },
					reqHeaders: {},
					retryLimit: fbConfig.retries || 0,
					timeout: fbConfig.timeout || 1000
				}
			)
		}
		console.log(screenName, 'facebook conversion event triggerd successfully on channel: ', channel, 'FB response:', resp)
		return true
	} catch (error) {
		console.log('Error occurred in facebook conversion call', error.message)
		return false
	}
}

// Hashing function to hash the user data, it returns an object with hashed values
const hashing = (email, phone, first_name, city, postal_code) => {
	console.log('Inside hashing function')
	let res = {}
	if (email) {
		email = email.trim().toLowerCase()
		let email_hashed = crypto.createHash('sha256', 'wtgames').update(email).digest('hex')
		res['em'] = email_hashed
	}
	if (phone) {
		phone = phone.replace('+', '')
		let phone_hashed = crypto.createHash('sha256', 'wtgames').update(phone).digest('hex')
		res['ph'] = phone_hashed
	}
	if (first_name) {
		first_name = first_name.toLowerCase()
		let spChars = /^[A-Za-z]*$/
		first_name = spChars.test(first_name) ? first_name : crypto.createHash('md5').update(utf8.encode(first_name)).digest('hex')
		let first_name_hashed = crypto.createHash('sha256', 'wtgames').update(first_name).digest('hex')
		res['fn'] = first_name_hashed
	}
	if (city) {
		city = city.trim().toLowerCase()
		let regEx = /^[A-Za-z]*$/
		city = regEx.test(city) ? city : crypto.createHash('md5').update(utf8.encode(city)).digest('hex')
		let city_hashed = crypto.createHash('sha256', 'wtgames').update(city).digest('hex')
		res['ct'] = city_hashed
	}
	if (postal_code) {
		postal_code = postal_code.trim().toLowerCase()
		let regEx = /^\d{6}$/
		postal_code = regEx.test(postal_code) ? postal_code : crypto.createHash('md5').update(utf8.encode(postal_code)).digest('hex')
		let postal_code_hashed = crypto.createHash('sha256', 'wtgames').update(postal_code).digest('hex')
		res['zp'] = postal_code_hashed
	}
	return res
}

// Get the channel URL based on the channel name if channel found in fb config else default URL
const getChannelUrl = (channel, fbConfig) => {
	if (fbConfig.channelUrls) {
		for (const obj of fbConfig.channelUrls) {
			if (obj.channels.includes(channel)) {
				return obj.url
			}
		}
	}
	return fbConfig.url
}