const axios = require('axios')
const axiosRetry = require('axios-retry')

const { urls } = require('../config/envUrls')
const { getEnv } = require('./getEnv')

const envUrl = urls[process.env.NODE_ENV]

const makeAxiosCall = async (screenName, sourceFunc, protocol, url, data, reqHeaders) => {
	console.log(screenName, sourceFunc, protocol, 'calling makeAxiosCall function')
	try {
		//	configuring axios call with 3 retries if retry is needed, else 0
		let retryObj = {
			retries: 3,		//	number of retries
			retryCondition: err => err.code === 'ECONNABORTED' || axiosRetry.isNetworkOrIdempotentRequestError(err),
			shouldResetTimeout: true,
			retryDelay: (retryCount) => {
				console.info(`${screenName} ${sourceFunc} ${protocol} retry attempt ${retryCount}`)
				return 20
			}
		}
		// console.info(screenName, sourceFunc, protocol, 'retry obj ==>', retryObj)
		axiosRetry(axios, retryObj)

		return await axios.post(url, data.data, { headers: reqHeaders || {} }, { timeout: 500 })
			.then((resp) => {
				console.info(screenName, sourceFunc, protocol, 'data push ==>', resp.data)
				return true
			})
			.catch((error) => {
				if (error?.response?.status !== 200) {
					throw new Error(`Call failed after ${retryObj.retries} retry attempts ==> ${error}`)
				}
				return false
			})
	} catch (error) {
		console.error(screenName, sourceFunc, protocol, 'error in makeAxiosCall ==>', error.message)
		return false
	}
}



const sendCtData = async (screenName, sourceFunc, data) => {
	console.log("***** STOPPED sendCtData ****")
	return true
	// console.log(screenName, sourceFunc, 'calling sendCtData function with retry')
	// let url = envUrl.CT_URL
	// let ctHeaders = {
	// 	'Content-Type': 'application/json',
	// 	'X-CleverTap-Account-Id': envUrl.PROJECT_ID,
	// 	'X-CleverTap-Passcode': envUrl.PASSCODE
	// }
	// return makeAxiosCall(screenName, sourceFunc, 'CT', url, data, ctHeaders)
}



const sendEmsData = async (screenName, sourceFunc, data) => {
	console.log(screenName, sourceFunc, 'calling sendEmsData function with retry')
	let url = envUrl.EMS_ORACLE_URL
	return makeAxiosCall(screenName, sourceFunc, 'emsOracle', url, data)
}



const sendInvData = async (screenName, sourceFunc, data) => {
	console.log(screenName, sourceFunc, 'calling sendInvData function with retry')
	let url = envUrl.EMS_INVENTORY_URL
	return makeAxiosCall(screenName, sourceFunc, 'emsInventory', url, data)
}



const sendAnalyticsData = async (screenName, sourceFunc, data) => {
	console.log(screenName, sourceFunc, 'calling sendAnalyticsData function with retry')
	let url = envUrl.EMS_ANALYTICS
	return makeAxiosCall(screenName, sourceFunc, 'emsAnalytics', url, data)
}



const sendPlotlineData = async (screenName, sourceFunc, data) => {
	console.log("***** STOPPED sendPlotlineData ****")
	return true
	// console.log(screenName, sourceFunc, 'calling sendPlotlineData function with retry')
	// let url = envUrl.PLOT_URL
	// let plotlineHeaders = {
	// 	'Content-type': 'application/json',
	// 	'api-key': getEnv('PLOTLINE_APIKEY'),
	// 	'ref-id': screenName
	// }
	// return makeAxiosCall(screenName, sourceFunc, 'plotline', url, data, plotlineHeaders)
}



const sendWebsocketData = async (screenName, sourceFunc, data) => {
	console.log(screenName, sourceFunc, 'calling sendWebsocketData function with retry')
	let url = envUrl.EMS_WEB_SOCKET_URL
	return makeAxiosCall(screenName, sourceFunc, 'websocket', url, data)
}



exports.sendProtocolsRetry = async (screenName, sourceFunc, dataToProtocols) => {
	console.log('*********** Send Protocols ***********')
	console.log(screenName, sourceFunc, 'calling sendProtocols function')
	try {
		let mapObject = {
			'ctData': sendCtData,
			'emsData': sendEmsData,
			'inventoryData': sendInvData,
			'analyticsData': sendAnalyticsData,
			'plotlineData': sendPlotlineData,
			'websocketData': sendWebsocketData
		}

		await Promise.allSettled(Object.keys(dataToProtocols)
			.map(keys => mapObject[keys](screenName, sourceFunc, dataToProtocols[keys])))
			.then((resp) => {
				for (let i = 0; i < resp.length; i++) resp[i].service = Object.keys(dataToProtocols)[i]
				console.log(screenName, sourceFunc, 'Result of all the calls ==> ', resp)
			})

		axiosRetry(axios, { retries: 0 })

		return true
	} catch (error) {
		console.error(screenName, sourceFunc, 'error in sendProtocols function ==>', error.message)
		console.log('*********** Send Protocols Error ***********')
		return false
	}
}