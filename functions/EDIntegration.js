const { makeGotCall } = require('../functions/makeGotCall')
const { findOneCache } = require('new-dynamo-wrapper')
const axios = require('axios')
const { randomUUID } = require('crypto')
const { getEnv } = require('./getEnv')

// const phase3DepricateAttributes = [
// 	'mobile',
// 	'email',
// 	'mobile_no',
// 	'appleIdEmail',
// 	'googleIdEmail',
// 	'facebookIdEmail',
// 	'address',
// 	'dob',
// 	'aadharNumber',
// 	'kycDocNumber',
// 	'panNumber',
// 	'panName',
// 	'kycDOB',
// 	'kycImageURL1',
// 	'kycImageURL2',
// 	'panImage',
// 	'panNameAtConsent'
// ]

const getAuthToken = async (loginData, requestId) => {
	try {
		console.log('Generating Auth Token for PII service', requestId)
		// fetching Token using client ID nd secret keys
		let tokenfetchData = await makeGotCall({
			screenName: '',
			sourceFunc: 'EDIntegration',
			protocol: 'CommonServices',
			url: `${getEnv('ED_URI')}/login`,
			data: loginData,
			reqHeaders: {
				'Content-Type': 'application/json; charset=UTF-8',
				'x-amzn-lambda-trace-id': requestId
			},
			retryLimit: 3,
			timeout: 1000
		})
		if (tokenfetchData?.token) {
			process.env.PII_TOKEN = tokenfetchData.token
			return tokenfetchData.token
		} else {
			console.error('Failed to create token for PII service', tokenfetchData)
		}
		return false
	} catch (error) {
		console.error('Error in Token generate', (error.response?.data || error?.message), error)
		return false
	}
}

/**
 * A function to integrate with PII-Service for data encryption and decryption.
 *
 * @param {string} action - the action to be performed
 * @param {object} data - the data to be encrypted or decrypted
 * @param {string} api_name - the name of the API
 * @param {string} service_name - the name of the service
 * @param {boolean} regenerateToken - flag to regenerate token
 * @return {object} the encrypted or decrypted data
 */
let piiConfig
exports.EDIntegration = async (action, data, api_name, service_name, regenerateToken) => {

	// fetching start time without relying on clock skew
	let startTime = process.hrtime.bigint()
	try {
		// fetching configs for PII enabled
		piiConfig = await findOneCache('settings', { _id: 'pf-pii-keys', type: 'pii' })

		console.log('Inside PII-Service EDIntegration')

		if (!piiConfig?.enabled) return await failureCase(data, action, api_name, service_name, 'PII-Service is disabled, returning plain data', startTime)

		// returning in case of empty data
		if (!data) return await failureCase(data, action, api_name, service_name, 'PII-Service data is empty, returning plain data', startTime)
		// checks for microservice level flag
		if (!piiConfig?.service_level_flag_for_pii && !piiConfig?.service_level_flag_for_pii[service_name]) return await failureCase(data, action, api_name, service_name, 'PII-Service is disabled for microservice, returning plain data', startTime)

		if (piiConfig?.service_level_flag_for_pii) console.log('PII-Service service_level_flag_for_pii for', service_name, piiConfig?.service_level_flag_for_pii[service_name])
		// data for the ED APIs
		let dataTobeEncrypt = {
			service_calling_pii: service_name,
			api_name: api_name,
			data: data
		}
		// parsing Client Ids from the calling microservice ENV variables
		if (!getEnv('PII_ID')) return await failureCase(data, action, api_name, service_name, 'PII-Service PII_ID not found in env variable, returning plain data', startTime)

		let clientIdData = JSON.parse(getEnv('PII_ID'))

		const requestId = getUniqueIdForPIIService()

		// clientIdData = (clientIdData[service_name] || clientIdData['platform-user'])		
		// gettting token from the login API for ED to access PII ED operations
		let tokenData = regenerateToken ? await getAuthToken(clientIdData, requestId) : getEnv('PII_TOKEN') || await getAuthToken(clientIdData, requestId)
		// Incase token fetch is getting errrros
		if (!tokenData) return await failureCase(data, action, api_name, service_name, 'PII-Service error while fetching token data, returning plain data', startTime)
		// fetching process PII-ED data using token in Header of the request
		let headers = {
			'Content-Type': 'application/json',
			'Authorization': tokenData,
			'x-amzn-lambda-trace-id': requestId
		}
		// let encryptedData = await makeGotCall({ screenName: '', sourceFunc: 'EDIntegration', protocol: 'CommonServices', url: `${process.env.ED_URI}/${action}`, data: dataTobeEncrypt, reqHeaders: headers, retryLimit: 3, timeout: 2000})
		console.info('PII Service RequestId : ', requestId)
		// changes for retry
		let encryptedData = await retryFunction(make_call_to_pii_service, [action, data, api_name, service_name, dataTobeEncrypt, headers], 3)


		let diffTimeInNanoSec = process.hrtime.bigint() - startTime
		console.log('pii_service_time_taken_success', (Number(diffTimeInNanoSec) / 1e6).toFixed(3))


		if (encryptedData) return encryptedData
		return data
	} catch (error) {
		console.error('PII-Service error occurred, returning plain data', action, api_name, service_name, `Error${(error.response?.data || error?.message)}`)
		return await failureCase(data, action, api_name, service_name, 'PII-Service error occurred, returning plain data', startTime)
	}
}

const make_call_to_pii_service = async (action, data, api_name, service_name, dataTobeEncrypt, headers) => {
	try {
		
		let encryptedData = await axios.post(`${getEnv('ED_URI')}/${action}`, dataTobeEncrypt, { headers, timeout: 1000 })

		console.log( 'PII Service API Call successfull')

		if (encryptedData?.status === 200 && encryptedData?.data) {
			// We need to add changes here for PIIphase3(adding only PII encrypted keys into DB no plain values)
			// let dataResponseObject = JSON.parse(JSON.stringify(encryptedData.data))
			// let EncryptedDataKeys = Object.keys(encryptedData.data)
			// // phase3DepricateAttributes.forEach(element => {
			// // 	if(EncryptedDataKeys.includes(element))	delete dataResponseObject[`${element}`]
			// // })
			// for (let iterator = 0; iterator < (phase3DepricateAttributes.length - 1); iterator++) {
			// 	let element = phase3DepricateAttributes[iterator]
			// 	if (EncryptedDataKeys.includes(element)) delete dataResponseObject[`${element}`]
			// }
			// console.log(dataResponseObject)
			// return dataResponseObject
			return removePlainPIIFromEncryptedDataForPhase3(JSON.parse(JSON.stringify(encryptedData.data)))
		}
		return false
	} catch (err) {
		if (err?.response?.data?.errorCode === 4011) {
			console.warn('PII-Service token expired, regenerating', action, api_name, service_name)
			return await this.EDIntegration(action, data, api_name, service_name, true)
		}
		throw err
	}
}

/**
 * Get a unique ID for the PIIService.
 *
 * @return {string} The unique ID for the PIIService.
 */
const getUniqueIdForPIIService = () => {
	if (process.env === undefined || process.env._X_AMZN_TRACE_ID === undefined) {
		console.error('getUniqueIdForPIIService: process.env or process.env._X_AMZN_TRACE_ID is undefined')
		return randomUUID()
	}

	try {
		return process.env._X_AMZN_TRACE_ID.split(';')[0]
	} catch (error) {
		console.error('getUniqueIdForPIIService: error while splitting process.env._X_AMZN_TRACE_ID', error)
		return randomUUID()
	}
}

const retryFunction = async (functionToBeRetried, args, counter) => {
	for (let i = 0; i < counter; i++) {
		try {
			return await functionToBeRetried(...args)
		} catch (err) {
			console.log(`Error occurred in retryFunction, Retrying, retry count, ${i + 1},  ${err?.message}`)
		}
	}
	return false
}

const return_plain_pii_in_encrypted_field = (obj, action) => {
	try {
		for (let curr in obj) {
			if (typeof (obj[curr]) === 'object' && !piiConfig?.nottoloop.includes(curr)) return_plain_pii_in_encrypted_field(obj[curr], action)
			if (piiConfig?.piiKeys.includes(curr) || piiConfig?.indexed_keys.includes(curr) || piiConfig?.indexTable.includes(curr)) {
				obj[`${curr}_encrypted`] = obj[curr]
				if (action === 'encrypt') {
					obj[`${curr}_masked`] = curr === 'email' || curr === 'upi' ? maskAllPII(obj[curr], 'email') : maskAllPII(obj[curr])
				}
			}
		}
		return obj
	} catch (err) {
		console.error('Error inside return_plain_pii_in_encrypted_field returning obj', err)
		return obj
	}
}

const removePlainPIIFromEncryptedDataForPhase3 = (obj)=>{
	for (let curr in obj) {
		if (typeof (obj[curr]) === 'object' && !piiConfig?.nottoloop.includes(curr)) removePlainPIIFromEncryptedDataForPhase3(obj[curr])
		if (piiConfig?.piiKeysForPhase3.includes(curr)) delete obj[curr]
	}
	return obj
}

const failureCase = async (data, action, api_name, service_name, message, start_time) => {
	try {
		console.error(message, action, api_name, service_name)
		if (!data) return data
		if (piiConfig?.to_throw_error_if_PII_service_fails) {
			throw new Error({ statusCode: piiConfig?.pii_service_error_statusCode, message: piiConfig?.pii_service_error_message })
		}
		console.log(`PII service action is ${action} calling return_plain_pii_in_encrypted_field ${api_name}, ${service_name}`)

		let diffTimeInNanoSec = process.hrtime.bigint() - start_time
		console.log('pii_service_time_taken_failure', (Number(diffTimeInNanoSec) / 1e6).toFixed(3))


		return return_plain_pii_in_encrypted_field(data, action)
	} catch (err) {
		console.error('PII service error occurred inside failureCase, returning plain data', err)
		let diffTimeInNanoSec = process.hrtime.bigint() - start_time
		console.log('pii_service_time_taken_failure', (Number(diffTimeInNanoSec) / 1e6).toFixed(3))
		throw err
	}
}

const maskAllPII = (string_to_be_masked, type) => {
	try {
		let len
		if (!type || type !== 'email') {
			len = string_to_be_masked.length - 4
			return string_to_be_masked.slice(0, len).replace(/./g, '*') + string_to_be_masked.slice(len)
		}
		let string_before_Attherate = string_to_be_masked.split('@')
		len = string_before_Attherate[0].length - 4
		return string_before_Attherate[0].slice(0, len).replace(/./g, '*') + string_before_Attherate[0].slice(len) + '@' + string_before_Attherate[1]
	} catch (err) {
		console.error('error occurred in masking all pii', err)
		return '********'
	}
}
