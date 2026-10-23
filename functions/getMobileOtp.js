const { findOne, core, remove, findOneCache } = require('new-dynamo-wrapper')
const axios = require('axios')
// const _ = require('underscore')
const { loginErrorCodes } = require('../errors')
const generateRandomNumber = require('random-number')
const { maskingfunc } = require('./maskingfunc')
const { EDIntegration } = require('./EDIntegration')
const { v4: uuidv4 } = require('uuid')
const { getEnv } = require('./getEnv')
let smsConfig

const getMobileOtp = async ({ mobile, otp, channel, screenName, flag, smsType, sendOtpViaWhatsApp }) => {
	try {
		console.log(`${screenName} Inside getMobile`, maskingfunc(mobile), channel, flag, smsType, 'sendOtpViaWhatsApp: ', sendOtpViaWhatsApp)
		if (!mobile) throw new Error(JSON.stringify(loginErrorCodes.InvalidMobile))
		let validIndianMobileCheck = isValidIndianMobileNumber(mobile)
		if (!validIndianMobileCheck) {
			console.log('Mobile is not a valid indian number', mobile, channel)
			return {
				'mockOTP': true,
				'mobile': mobile,
				'message': `OTP has been sent to ${mobile.slice(0, 6)}xxxxxx${mobile.slice(12, 13)}`
			}
		}
		let encryptMobile = await EDIntegration('encrypt', { mobile }, 'getMobileOtp', 'platform-commonServices')
		let otpValue = await findOne('otp', { mobile: encryptMobile?.mobile_encrypted })
		if (otpValue) {
			if (flag) {
				await otpCount(otpValue)
			}
		}

		if(sendOtpViaWhatsApp) {
			console.log(`${screenName} Sending otp via WhatsApp - as sendOtpViaWhatsApp is true`)
			const whatsappConfig = await findOneCache('settings', { _id: 'pf-sendWhatsApp', type: 'code' })
			return await (whatsappConfig?.sendMockOtp) ? mochSendSMS(mobile, otp) : sendViaWhatsApp(mobile, otp, channel, screenName, whatsappConfig)
		}

		smsConfig = await findOneCache('settings', { _id: 'pf-sendSms', type: 'code' })
		console.log('sending req to sendSMS function')
		return await (smsConfig.sendSMS) ? sendSMS(mobile, otp, channel, screenName, smsConfig, smsType) : mochSendSMS(mobile, otp)

	} catch (error) {
		console.log({ 'error': { message: error, statusCode: 1000 } })
		// throw new Error(JSON.stringify({ message: error.message, statusCode: 1000 }))
		throw error
	}

}

const sendViaWhatsApp = async (mobile, otp, channel, screenName, whatsappConfig) => {
	try{
		console.log(screenName, 'Inside sendViaWhatsApp function', maskingfunc(mobile), otp, channel)

		const apiUrl = 'https://media.smsgupshup.com/GatewayAPI/rest'

		let message = whatsappConfig.message
		message = message.replace(/replaceOtp/g, otp)

		const apiParams = {
			userid: getEnv('GUPSHUP_USERID'),
			password: getEnv('GUPSHUP_PASSWORD'),
			send_to: mobile, // Mobile number should be in the format +91XXXXXXXXXX
			v: '1.1',
			format: 'json',
			msg_type: 'TEXT',
			method: 'SENDMESSAGE',
			msg: message,
			isTemplate: true,
			footer: whatsappConfig.footer
		}
		console.log(screenName, 'Sending request to WhatsApp API')

		const response = await axios.get(apiUrl, { params: apiParams, timeout: whatsappConfig?.timeout || 1000 })

		console.log(screenName, 'Successfully received response from WhatsApp API', response.data, response.status)

		if (response?.status === 200 && response.data?.response?.status === 'success') {

			await insertOtpToDb({ mobile: mobile, session_id: response.data?.response?.id, source: 'whatsapp-Gupshup', otp: otp })
			console.log(screenName, 'otp inserted into db successfully', channel)
			return {
				'otpSent': true,
				'mobile': mobile,
				'message': `OTP has been sent to ${mobile.slice(0, 6)}xxxxxx${mobile.slice(12, 13)} via WhatsApp`
			}

		} else {
			console.log(screenName, 'WhatsApp API response error:', response?.data || response)
			throw new Error('something went wrong while sending whatsapp OTP' )
		}
	}
	catch (error) {
		console.log(screenName, 'Error occurred in sendViaWhatsApp->', error?.message)
		throw (error)
	}
}

const sendSMS = async (mobile, otp, channel, screenName, smsConfig, smsType) => {
	let smsCallTimeoutSmsStriker = smsConfig?.smsTimeoutSmsStriker || 1000
	let smsCallTimeoutKaleyra = smsConfig?.smsTimeoutkaleyra || 1000
	let smsStrikerFlag = smsConfig?.smsStrikerFlag
	let kaleyraFlag = smsConfig?.kaleyraFlag
	let specificSmsConfig
	var message
	var kaleyramessage
	var smsStrikermessage
	let fromSender
	let selectKaleyraFunction
	let selectSMSStrikerFunction
	let smsSuggestions
	try {
		console.log(screenName, 'Inside try block ,sendSms function ')

		let smsSignature = (smsConfig?.channelwiseSignature[channel] ? smsConfig?.channelwiseSignature[channel] : '3d0aH5sFDny')
		console.log('channel:', channel, 'smsSignature:', smsSignature)

		specificSmsConfig = smsConfig[smsType]
		message = specificSmsConfig.message
		kaleyramessage = specificSmsConfig?.kaleyramessage
		smsStrikermessage = smsConfig?.callNewSMSStrikerApi && getEnv('SMSSTRIKER_APIKEY') && smsConfig?.newSMSStrikerMessageTypes.includes(smsType) ? specificSmsConfig?.smsStrikermessageNew : specificSmsConfig?.smsStrikermessage
		fromSender = specificSmsConfig?.from

		message = message.replace(/replaceHash/g, smsSignature)
		message = message.replace(/replaceOtp/g, otp)

		if (kaleyramessage) {
			kaleyramessage = kaleyramessage.replace(/replaceHash/g, smsSignature)
			kaleyramessage = kaleyramessage.replace(/replaceOtp/g, otp)
		}
		if (smsStrikermessage) {
			smsStrikermessage = smsStrikermessage.replace(/replaceHash/g, smsSignature)
			smsStrikermessage = smsStrikermessage.replace(/replaceOtp/g, otp)
		}
		// let smsSettingCheck = await findOne('settings', { _id: 'pf-sms-order', type: 'sms' })
		// if (!smsSettingCheck) throw new Error('sms suggestions data not found')
		// console.log("smsSuggestions", smsSettingCheck)
		// var smsSuggestions = _.findWhere(smsSettingCheck.suggestions, { "order": 1 }).value
		smsSuggestions = findSmsSuggestionsThorughRandomNumber(smsConfig, smsType)
		console.log('Having sms suggestions', smsSuggestions)

		selectKaleyraFunction = smsConfig?.callNewKaleyraApi ? sendSmsThroughKaleyraNew : sendSmsThroughKaleyra
		selectSMSStrikerFunction = smsConfig?.callNewSMSStrikerApi && getEnv('SMSSTRIKER_APIKEY') ? sendSmsThroughSmsStrikerNew : sendSmsThroughSmsStriker

		if (smsSuggestions === 'kaleyra') {
			console.log(`${screenName} Sending req to kaleyra In try block, type of sms is : ${smsType}`)
			let kaleyraReq = await selectKaleyraFunction(mobile, otp, screenName, kaleyramessage || message, smsCallTimeoutKaleyra, kaleyraFlag, fromSender)
			return kaleyraReq
		} else {
			console.log(`${screenName} Sending req to smsStriker In try block, type of sms is : ${smsType}`)
			let smsStrikerReq = await selectSMSStrikerFunction(mobile, otp, screenName, smsStrikermessage || message, smsConfig, smsType, smsCallTimeoutSmsStriker, smsStrikerFlag, fromSender)
			return smsStrikerReq
		}
	} catch (error) {
		console.log('error in try block of sendSms :', error.message)
		console.log(`${screenName} Inside catch block ,Error while calling Otp function through ${smsSuggestions}`)
		try {
			if (smsSuggestions === 'kaleyra') {
				console.log(`${screenName} Sending req to smsStriker In catch block, type of sms is : ${smsType}`)
				if (error?.message === `timeout of ${smsCallTimeoutKaleyra}ms exceeded`) {
					console.log(`${screenName} Sending sms through smsStriker as Kaleyra is throwing Timeout`)
				} else {
					// LLog for the case when error is other than timeout, changes made as per NPJ - 1220
					console.log('Error recieved from Kaleyra :', error)
				}
				let smsStrikerReq = await selectSMSStrikerFunction(mobile, otp, screenName, smsStrikermessage || message, smsConfig, smsType, smsCallTimeoutSmsStriker, smsStrikerFlag, fromSender)
				return smsStrikerReq
			} else {
				console.log(`${screenName} Sending req to kaleyra In catch block, type of sms is : ${smsType}`)
				if (error?.message === `timeout of ${smsCallTimeoutSmsStriker}ms exceeded`) {
					console.log(`${screenName} Sending sms through kaleyra as smsStriker is throwing Timeout`)
				} else {
					// LLog for the case when error is other than timeout, changes made as per NPJ- 1220
					console.log('Error recieved from smsStriker :', error)
				}
				let kaleyraReq = await selectKaleyraFunction(mobile, otp, screenName, kaleyramessage || message, smsCallTimeoutKaleyra, kaleyraFlag, fromSender)
				return kaleyraReq
			}

		} catch (error) {
			console.log('Re-routing sms service is throwing error', error)
			throw error
		}
	}

}

const mochSendSMS = async (mobile, otp) => {
	try {
		await insertOtpToDb({ mobile: mobile, session_id: 'NA', source: 'smsstriker', 'otp': otp })
		return {
			'otpSent': true,
			'mobile': mobile,
			'message': `OTP has been sent to ${mobile.slice(0, 6)}xxxxxx${mobile.slice(12, 13)}`
		}
	} catch (error) {
		console.log('error', error)
		return {
			'otpSent': false,
			'mobile': mobile,
			'message': `OTP has been sent to ${mobile.slice(0, 6)}xxxxxx${mobile.slice(12, 13)}`
		}
	}
}

const sendSmsThroughKaleyra = async (mobile, otp, screenName, message, smsCallTimeoutKaleyra, kaleyraFlag, sender) => {
	try {
		console.log(`${screenName} Inside sendSmsThroughKaleyra function, timeout as per Config : ${smsCallTimeoutKaleyra}`)
		let from = sender || 'ATOTHR'
		let url = `https://api-alerts.kaleyra.com/v4/?api_key=${getEnv('KALEYRA_KEY')}&method=sms&message=${message}&to=${mobile}&sender=${from}`

		let params = { method: 'post', url }
		if (kaleyraFlag) {
			params['timeout'] = smsCallTimeoutKaleyra
		}
		// let start = performance.now()
		let { data } = await axios(params)
		// let end = performance.now()
		// console.log(`Time taken by Kaleyra to give response : ${(end - start).toFixed(5)} ms`)
		console.log('Kaleyra response : ', data.message)
		if (data) {
			if (data.status !== 'OK') throw new Error(data.message)
			if (data.data[0]) {
				console.log('otp send successfully sent through Kaleyra')
				let responseObj = {}
				if (data.data[0].status === 'AWAITED-DLR') {// Get current time
					await insertOtpToDb({ mobile: mobile, session_id: data.data[0].id, source: 'smsstriker', 'otp': otp })
					responseObj = {
						'otpSent': true,
						'mobile': mobile,
						'message': `OTP has been sent to ${mobile.slice(0, 6)}xxxxxx${mobile.slice(12, 13)}`
					}
					console.log(screenName, 'otp sent successfully through kaleyra')
					return responseObj
				}
			}
		} else throw new Error(data.message)
	} catch (error) {
		console.log('Error occurred in sendSmsThroughKeleyra->', error)
		throw (error)
	}

}

const sendSmsThroughKaleyraNew = async (mobile, otp, screenName, message, smsCallTimeoutKaleyra, kaleyraFlag, sender) => {
	try {
		console.log(`${screenName} Inside sendSmsThroughKaleyraNew function, timeout as per Config : ${smsCallTimeoutKaleyra}`)

		let configObj = {
			method: 'POST',
			url: getEnv('KALEYRA_API_URL'),
			headers: {
				'Content-Type': 'application/json',
				'api-key': getEnv('KALEYRA_API_KEY')
			},
			data: {
				to: mobile,
				sender: sender || 'ATOTHR',
				body: message,
				type: 'OTP',
				//callback_profile_id: getEnv('KALEYRA_CALLBACK_PROFILE_ID')
			}
		}
		if (smsConfig?.kalyera_callback_profile_id) configObj.data['callback_profile_id'] = smsConfig.kalyera_callback_profile_id
		if (kaleyraFlag) {
			configObj['timeout'] = smsCallTimeoutKaleyra
		}

		let response = await axios(configObj)
		console.log('kaleyra response:', response.data)

		if (response?.status === 202 && response.data?.data[0]) {
			await insertOtpToDb({ mobile: mobile, session_id: response.data?.id, source: 'kaleyra', otp: otp })
			const responseObj = {
				'otpSent': true,
				'mobile': mobile,
				'message': `OTP has been sent to ${mobile.slice(0, 6)}xxxxxx${mobile.slice(12, 13)}`
			}
			console.log(screenName, 'otp sent successfully through new kaleyra')
			return responseObj

		} else throw new Error(response.data)

	} catch (error) {
		console.log('Error occurred in sendSmsThroughKaleyraNew:', error)
		throw (error)
	}
}


const sendSmsThroughSmsStriker = async (mobile, otp, screenName, message, smsConfig, smsType, smsCallTimeoutSmsStriker, smsStrikerFlag, sender) => {
	try {
		console.log(`${screenName} Inside sendSmsThrough smsStriker function, timeout as per Config : ${smsCallTimeoutSmsStriker}`)
		let from = sender || 'ATOTHR'
		let baseUrl = getEnv('SMSSTRIKER_URL')
		// console.log("number",to.slice(0,12))
		let params = { username: getEnv('SMSSTRIKER_USERNAME'), password: getEnv('SMSSTRIKER_PASSWORD'), from: from, to: mobile.replace('+91', ''), msg: message, type: '1', template_id: smsConfig[smsType].smsStrikerTemplateId, ref_id: uuidv4() }
		let axiosParams = {
			method: 'GET',
			url: baseUrl,
			params: params
		}
		if (smsStrikerFlag) {
			axiosParams['timeout'] = smsCallTimeoutSmsStriker
		}
		// let start = performance.now()
		let smsstrikerRes = await axios(axiosParams)
		// let end = performance.now()
		// console.log(`Time taken by SmsStriker to give response : ${(end - start).toFixed(5)} ms`)
		console.log(screenName, 'sms striker response :', smsstrikerRes.data)
		if (!smsstrikerRes.data || smsstrikerRes.status !== 200) throw new Error('smsstriker failed to send otp')
		if (smsstrikerRes.status === 200) {
			console.log('otp send successfully sent through smsStriker')
			let jobId = smsstrikerRes.data.split(',')[0].replace('{Job Id: ', '').trim()
			await insertOtpToDb({ mobile: mobile, session_id: jobId, source: 'smsstriker', 'otp': otp })
			let responseObj = {
				'otpSent': true,
				'mobile': mobile,
				'message': `OTP has been sent to ${mobile.slice(0, 6)}xxxxxx${mobile.slice(12, 13)}`
			}
			console.log(screenName, 'otp sent successfully through sms striker')
			return responseObj
		}
	} catch (error) {
		console.log('Error occurred in sendSmsThroughSmsStriker->', error)
		throw (error)
	}
}

const sendSmsThroughSmsStrikerNew = async (mobile, otp, screenName, message, smsConfig, smsType, smsCallTimeoutSmsStriker, smsStrikerFlag, sender) => {
	try {
		console.log(`${screenName} Inside sendSmsThrough smsStrikernew function, timeout as per Config : ${smsCallTimeoutSmsStriker}`)
		let from = sender || 'ATOTHR'
		let baseUrl = getEnv('SMSSTRIKER_URL_NEW')
		// console.log("number",to.slice(0,12))
		let otpConfig = {
			method: 'POST',
			url: baseUrl,
			data: {
				username: getEnv('SMSSTRIKER_USERNAME'),
				password: getEnv('SMSSTRIKER_APIKEY'),
				from: from,
				to: mobile.replace('+91', ''),
				msg: message,
				type: '1',
				ref_id: uuidv4()
			}
		}
		if (smsStrikerFlag) {
			otpConfig['timeout'] = smsCallTimeoutSmsStriker
		}
		let smsstrikerRes = await axios(otpConfig)
		console.log(screenName, 'sms striker new response :', smsstrikerRes.data)
		if (!smsstrikerRes.data || smsstrikerRes.status !== 200) throw new Error('smsstriker failed to send otp')
		if (smsstrikerRes.status === 200) {
			console.log('otp send successfully sent through new smsStriker')
			let jobId = smsstrikerRes.data.split(',')[0].replace('{Job Id: ', '').trim()
			await insertOtpToDb({ mobile: mobile, session_id: jobId, source: 'smsstriker', 'otp': otp })
			let responseObj = {
				'otpSent': true,
				'mobile': mobile,
				'message': `OTP has been sent to ${mobile.slice(0, 6)}xxxxxx${mobile.slice(12, 13)}`
			}
			console.log(screenName, 'otp sent successfully through new sms striker')
			return responseObj
		}
	} catch (error) {
		console.log('Error occurred in sendSmsThroughSmsStrikerNew->', error)
		throw (error)
	}
}
const findSmsSuggestionsThorughRandomNumber = (smsConfig, smsType) => {
	let options = { min: 1, max: 100, integer: true }
	let randomNumber = generateRandomNumber(options), smsSuggestions
	console.log('random number for Sms Sugesstions', randomNumber)

	let maxValue

	let specificSmsConfig = smsConfig[smsType]
	console.log(specificSmsConfig)

	if (specificSmsConfig.primarySMSProvider != undefined)
		maxValue = specificSmsConfig.primarySMSProvider
	else
		maxValue = smsConfig.defaultprimarySMSProvider

	// console.log(maxValue)
	smsSuggestions = (randomNumber <= maxValue) ? (specificSmsConfig.primarySMSProviderName ? specificSmsConfig.primarySMSProviderName : smsConfig.defaultPrimarySMSProviderName) : (specificSmsConfig.secondarySMSProviderName ? specificSmsConfig.secondarySMSProviderName : smsConfig.defaultsecondarySMSProviderName)

	console.log('maxValue:', maxValue)
	console.log('smsSuggestions:', smsSuggestions)
	return smsSuggestions
}

const otpCount = async (otpValue) => {
	try {
		let otpTimer = await findOne('settings', { _id: 'pf-otp-timer', 'type': 'config' })
		if (otpTimer) {
			for (let data of otpTimer.config) {
				if (data.to >= otpValue.otpCount && data.from <= otpValue.otpCount) {
					let nextOtpSendingTime = Number(+new Date(otpValue.updatedAt).setSeconds(new Date(otpValue.updatedAt).getSeconds() + Number(data.delayTimer)))
					if (nextOtpSendingTime > +new Date()) {
						let time = (((nextOtpSendingTime - Number(+new Date())) / 60000) > 1) ? `${Math.ceil((nextOtpSendingTime - Number(+new Date())) / 60000)} minutes` : `${Math.ceil((nextOtpSendingTime - Number(+new Date())) / 1000)} seconds`
						let errorMessage = {
							statusCode: 2023,
							message: `You have exceeded the maximum number of otp attempts. Please try after ${time}`
						}
						throw new Error(JSON.stringify(errorMessage))
					}
					if (Math.round(+new Date() / 1000) >= otpValue.expiryttl) {
						await remove('otp', { mobile: otpValue.mobile })
					}
				}
			}
		}
		return true
	} catch (err) {
		console.log(maskingfunc(otpValue.mobile), 'Count excedeed, throwing error')
		throw err
	}
}

const insertOtpToDb = async ({ session_id, mobile, otp, source }) => {
	try {
		console.log(maskingfunc(mobile), 'Inside insertOtpToDb')
		let otpTimer = await findOne('settings', { _id: 'pf-otp-timer', 'type': 'config' })
		let maxOtpCount = otpTimer.maxOtpCount || 5
		let now = new Date()
		// Add 15 minutes
		// changed expirytll to 10 digits for db auto deletion
		let encryptedData = await EDIntegration('encrypt', { mobile }, 'getMobileOtp', 'platform-commonServices')
		let fifteenMinutesLater = Math.round(+new Date(now.getTime() + 15 * 60000) / 1000)
		let otpUpdateExpression = 'set #session_id = :session_id, #otp = :otp, #source = :source, #otpCount =  if_not_exists(#otpCount, :start) + :otpCount, #updatedAt = :updatedAt, #expiryttl = :expiryttl'
		let conditionExpression = 'attribute_not_exists(otpCount) OR #otpCount <= :maxCount'
		let otpAttributesNames = {
			'#session_id': 'session_id',
			'#otp': 'otp',
			'#source': 'source',
			'#otpCount': 'otpCount',
			'#updatedAt': 'updatedAt',
			'#expiryttl': 'expiryttl'
		}
		let otpAttributesValues = {
			':session_id': session_id,
			':otp': otp,
			':source': source,
			':otpCount': 1,
			':updatedAt': +new Date(),
			':expiryttl': fifteenMinutesLater,
			':start': 0,
			':maxCount': maxOtpCount
		}
		if (encryptedData?.mobile_encrypted) {
			// change in update expression
			otpUpdateExpression += ', #mobile_masked = :mobile_masked'
			// change in attribute name
			otpAttributesNames['#mobile_masked'] = 'mobile_masked'
			// change in attribute value
			otpAttributesValues[':mobile_masked'] = encryptedData.mobile_masked
		}

		try {
			await core('transactWrite', {
				TransactItems: [{
					Update: {
						TableName: 'otp',
						Key: { mobile: encryptedData.mobile_encrypted ? encryptedData.mobile_encrypted : mobile },
						UpdateExpression: otpUpdateExpression,
						ConditionExpression: conditionExpression,
						ExpressionAttributeNames: otpAttributesNames,
						ExpressionAttributeValues: otpAttributesValues
					}
				}]
			})
			return true
		} catch (err) {
			console.log(maskingfunc(mobile), 'error occurred while updating otp --> retrying')
			await core('transactWrite', {
				TransactItems: [{
					Update: {
						TableName: 'otp',
						Key: { mobile: encryptedData.mobile_encrypted ? encryptedData.mobile_encrypted : mobile },
						UpdateExpression: otpUpdateExpression,
						ConditionExpression: conditionExpression,
						ExpressionAttributeNames: otpAttributesNames,
						ExpressionAttributeValues: otpAttributesValues
					}
				}]
			})
			return true
		}
	} catch (err) {
		console.log(maskingfunc(mobile), 'error occurred while inserting otp in db', err)
		throw new Error(JSON.stringify({ message: 'something went wrong' }))
	}
}


const isValidIndianMobileNumber = (mobile) => {
	const regex = /^\+91\d{10}$/
	return regex.test(mobile)
}
exports.getMobileOtp = getMobileOtp