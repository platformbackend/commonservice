const { findOne, findOneCache, core } = require('new-dynamo-wrapper')
// const axios = require('axios')
// const _ = require('underscore')
const { loginErrorCodes } = require('../errors')
const { maskingfunc } = require('./maskingfunc')
const { EDIntegration } = require('./EDIntegration')

const checkMobileOtp = async ({ mobile, otp, flag, user }) => {
	try {
		console.log(maskingfunc(mobile), 'Inside check Mobile otp ', flag)
		if (!mobile) throw new Error(JSON.stringify(loginErrorCodes.InvalidMobile))
		let otpTimer
		let reset = false
		// let decryptedData = await EDIntegration('decrypt', { mobile }, 'checkMobileOtp', 'platform-commonServices')
		let encryptedData = await EDIntegration('encrypt', { mobile }, 'getMobileOtp', 'platform-commonServices')
		console.log(maskingfunc(mobile), 'encryptedData =>', encryptedData)
		let encryption = true
		let otpValue = await findOne('otp', { mobile: encryptedData?.mobile_encrypted })
		console.log(maskingfunc(mobile), 'otpValue ->', otpValue)

		let mobileNumber = mobile

		if (!otpValue) {
			otpValue = await findOne('otp', { mobile: mobile })
			encryption = false
		}

		if (!otpValue) return {
			otpMatched: 'expired',
			mobile: mobileNumber,
			message: 'OTP Expired.'
		}
		// rate limit on failed otp attempts
		if (flag) {
			otpTimer = await findOneCache('settings', { _id: 'pf-otp-timer', 'type': 'config' })
			if (!user) user = await findOne('logs_table_new', { _id: encryptedData?.mobile_encrypted || mobile, userId: 'invalidOtpCoolOff' })
			if (otpValue?.invalidotpCount >= otpTimer.invalidOtpAttemptCount && user?.invalidOtpCoolOff >= +new Date()) {
				let errorMessage = {
					statusCode: 2024,
					message: 'You have reached the maximum number of OTP attempts'
				}
				throw new Error(JSON.stringify(errorMessage))
			}
			if (user?.invalidOtpCoolOff <= +new Date()) reset = true
		}
		let currentTime = Math.floor(+new Date() / 1000)
		let expiryTime = otpValue.expiryttl
		console.log('current time => ', currentTime)
		console.log('expiry ttl => ', expiryTime)

		if (expiryTime >= currentTime) {
			if (otpValue.otp == Number(otp)) {
				return {
					otpMatched: 'matched',
					mobile: mobileNumber,
					message: 'OTP matched.'
				}
			}
			// if otp is incorrect, increment count and increment coolOff
			if (flag) {
				await insertOtpToDb({ mobile: encryption ? encryptedData.mobile_encrypted ? encryptedData.mobile_encrypted : mobile : mobile, user, otpTimer, otpValue, reset })
				console.log('otpRateLimit', user?.screenName ? user.screenName : maskingfunc(mobile), otpValue.invalidotpCount)
			}
			return {
				otpMatched: 'noMatch',
				mobile: mobileNumber,
				message: 'OTP not matched.'
			}
		}
		return {
			otpMatched: 'expired',
			mobile: mobileNumber,
			message: 'OTP Expired.'
		}
	} catch (error) {
		console.log({ 'error': { message: error.message, statusCode: 1000 } })
		//return { 'error': { message: error.message, statusCode: 1000 } }
		throw error
	}
}

const insertOtpToDb = async ({ mobile, user, otpTimer, otpValue, reset }) => {
	try {
		console.log('inside insertOtpToDb', 'mobile:', mobile, 'reset:', reset)
		let invalidOtpCoolOff = Number(+new Date().setSeconds(new Date().getSeconds() + Number(otpTimer.invalidOtpAttemptCoolOff)))
		await core('transactWrite', {
			TransactItems: [
				{
					Update: {
						TableName: 'otp',
						Key: { mobile: mobile },
						UpdateExpression: reset ? 'set #invalidotpCount =:invalidotpCount' : 'set #invalidotpCount = if_not_exists(#invalidotpCount, :start) + :invalidotpCount',
						ExpressionAttributeNames: { '#invalidotpCount': 'invalidotpCount' },
						ExpressionAttributeValues: reset ? { ':invalidotpCount': 1 } : { ':invalidotpCount': 1, ':start': 0 }
					}
				},
				(!otpValue.invalidotpCount || reset) ? {
					Update: {
						TableName: user?.screenName ? 'users' : 'logs_table_new',
						Key: user?.screenName ? { _id: user._id } : { _id: mobile, userId: 'invalidOtpCoolOff' },
						UpdateExpression: user?.screenName ? 'set #invalidOtpCoolOff = :invalidOtpCoolOff' : 'set #invalidOtpCoolOff = :invalidOtpCoolOff, #ttl = :ttl',
						ExpressionAttributeNames: user?.screenName ? { '#invalidOtpCoolOff': 'invalidOtpCoolOff' } : { '#invalidOtpCoolOff': 'invalidOtpCoolOff', '#ttl': 'ttl' },
						ExpressionAttributeValues: user?.screenName ? { ':invalidOtpCoolOff': invalidOtpCoolOff } : { ':invalidOtpCoolOff': invalidOtpCoolOff, ':ttl': +new Date() + (60 * 60 * 1000) }
					}
				} : undefined
			]
		})
		return true
	} catch (err) {
		console.log(maskingfunc(mobile), 'error occurred while inserting invalid otp count in db', err)
		throw new Error(JSON.stringify({ message: 'something went wrong' }))
	}
}
exports.checkMobileOtp = checkMobileOtp