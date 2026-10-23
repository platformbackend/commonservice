const { makeGotCall } = require('./makeGotCall')
const { findOneCache } = require('new-dynamo-wrapper')
// const { urls } = require('../config/envUrls')
const { sendProtocolsValidation } = require('../utils/requestValidation')
const { getEnv } = require('./getEnv')

// const envUrl = urls[process.env.NODE_ENV]


/**	
 * Function for sending the network call
 * @param {string} screenName				screenName of the user
 * @param {string} sourceFunc				function from where the call if done
 * @param {string} protocol					protocol being sent
 * @param {string} url							protocol url
 * @param {object} data							the data object
 * @param {object} reqHeaders				request headers (if any)
 * 
 * @returns {Promise.<boolean>}
 **/
const makeNetworkCall = async (screenName, sourceFunc, protocol, config, data, reqHeaders = {}) => {
	try {
		
		if (typeof data?.config?.retry === 'number') config.retries = data?.config?.retry
		else config.retries = data?.config?.retry ? config.retries : 0
		return makeGotCall({ screenName: screenName, sourceFunc: sourceFunc, protocol: protocol, url: config.url, data: data.data, reqHeaders: reqHeaders, retryLimit: config.retries || 0, timeout: config.timeout || 500 })
	} catch (error) {
		console.error(screenName, sourceFunc, protocol, 'error in makeGotCall:', error.message)
		return false
	}
}


/**	
 * Function for formatting and sending the EMS Oracle call
 * @param {string} screenName							screenName of the user
 * @param {string} sourceFunc							function from where the call if done
 * @param {object} data										the data object for ems oracle
 * @param {object} data.data							data to send to ems oracle
 * @param {object} data.config						config for the call
 * @param {boolean} isEnabled							whether protocol is enabled
 * 
 * @returns {Promise.<boolean>}
 **/
const sendCtData = async (screenName, sourceFunc, data, protocolsConfig) => {
	console.log("***** STOPPED sendCtData ****")
	return true
	// let defaultConfig = protocolsConfig.clevertapConfig

	// let ctHeaders = {
	// 	'Content-Type': 'application/json',
	// 	'X-CleverTap-Account-Id': getEnv('PROJECT_ID'),
	// 	'X-CleverTap-Passcode': getEnv('PASSCODE'),
	// }

	// return makeNetworkCall(screenName, sourceFunc, 'CT call', defaultConfig, data, ctHeaders)
}

/**
 * Function for formatting and sending the MixPanel call
 * @param {string} screenName							screenName of the user
 * @param {string} sourceFunc							function from where the call if done
 * @param {object} data									the data object for mixpanel
 * @param {object} protocolsConfig						config for the call fetched from database
 *
 * */
const sendMixPanelData = async (screenName, sourceFunc, data, protocolsConfig) => {
	console.log("***** STOPPED sendMixPanelData ****")
	return true
	// console.log(screenName, sourceFunc, 'calling sendMixPanelData function')
	// let defaultConfig = protocolsConfig.mixPanelConfig
	// console.log('url is', data.data.toBeUpdated)
	// let mixPanelheaders = {
	// 	'Content-Type': 'application/json',
	// 	'Authentication': getEnv('MIXPANEL_TOKEN')
	// }

	// if (data.data.toBeUpdated === 'event') {
	// 	let defaultParams = {
	// 		ip: 1,
	// 		verbose: true,
	// 		img: 0,
	// 		callback: true
	// 	}

	// 	console.log(JSON.stringify(data))
	// 	defaultConfig.url = defaultConfig.url + '/track'
	// 	defaultParams = data.data.queryParams ? data.data.queryParams : defaultParams
	// 	let url = defaultConfig.url + '?'
	// 	for (let i = 0; i < Object.keys(defaultParams).length; i++) {
	// 		url += Object.keys(defaultParams)[i] + '=' + Object.values(defaultParams)[i] + '&'
	// 	}
	// 	url = url.slice(0, -1)

	// 	defaultConfig.url = url
	// 	console.log('url is', defaultConfig.url)


	// 	delete data.data.toBeUpdated
	// 	delete data.data.queryParams
	// 	delete data.config
	// 	data.data.properties.distinct_id = screenName
	// 	data.data.properties.insert_id = screenName
	// 	data.data.properties.token = getEnv('MIXPANEL_TOKEN')

	// 	data.data = [data?.data]
	// 	data.data[0].event = data.data[0].eventName
	// 	console.log('event is', data.data[0].event)
	// 	delete data.data[0].eventName
	// 	console.log('MIX Panel data', JSON.stringify(data))

	// 	// console.log('data is', JSON.stringify(data))
	// 	await makeNetworkCall(screenName, sourceFunc, 'mixPanel', defaultConfig, data, mixPanelheaders)


	// }
	// if (data.data.toBeUpdated === 'people') {
	// 	defaultConfig.url = defaultConfig.url + '/engage#profile-set'
	// 	let dataToSend = {}
	// 	dataToSend['$token'] = getEnv('MIXPANEL_TOKEN')
	// 	dataToSend['$distinct_id'] = data.data.distinctId
	// 	dataToSend['$set'] = data.data.properties
	// 	data.data = [dataToSend]
	// 	await makeNetworkCall(screenName, sourceFunc, 'mixPanel', defaultConfig, data, mixPanelheaders)
	// 	// await mp.people.set(data.data.distinctId, data.data.properties)
	// }
	// console.log(screenName, sourceFunc, 'MixPanel Updation Done')
	// return true

}


/**	
 * Function for formatting and sending the EMS Oracle call
 * @param {string} screenName							screenName of the user
 * @param {string} sourceFunc							function from where the call if done
 * @param {object} data										the data object for ems inventory
 * @param {object} data.data							data to send to ems inventory
 * @param {object} data.config						config for the call
 * @param {boolean} isEnabled							whether protocol is enabled
 * 
 * @returns {Promise.<boolean>}
 **/
const sendEmsData = async (screenName, sourceFunc, data, protocolsConfig) => {
	let defaultConfig = protocolsConfig.emsConfig

	return makeNetworkCall(screenName, sourceFunc, 'emsOracle', defaultConfig, data)
		.then(() => true)
}


/**	
 * Function for formatting and sending the EMS inventory call
 * @param {string} screenName							screenName of the user
 * @param {string} sourceFunc							function from where the call if done
 * @param {object} data										the data object for ems inventory
 * @param {object} data.data							data to send to ems inventory
 * @param {object} data.config						config for the call
 * @param {boolean} isEnabled							whether protocol is enabled
 * 
 * @returns {Promise.<boolean>}
 **/
const sendInvData = async (screenName, sourceFunc, data, protocolsConfig) => {
	let defaultConfig = protocolsConfig.emsInventoryConfig

	return makeNetworkCall(screenName, sourceFunc, 'emsInventory', defaultConfig, data)
		.then(() => true)
}


/**	
 * Function for formatting and sending the EMS analytics call
 * @param {string} screenName							screenName of the user
 * @param {string} sourceFunc							function from where the call if done
 * @param {object} data										the data object for ems analytics
 * @param {object} data.data							data to send to ems analytics
 * @param {object} data.config						config for the call
 * @param {boolean} isEnabled							whether protocol is enabled
 * 
 * @returns {Promise.<boolean>}
 **/
const sendAnalyticsData = async (screenName, sourceFunc, data, protocolsConfig) => {
	let defaultConfig = protocolsConfig.emsAnalyticsConfig

	return makeNetworkCall(screenName, sourceFunc, 'emsAnalytics', defaultConfig, data)
		.then(() => true)
}


/**	
 * Function for formatting and sending the plotline call
 * @param {string} screenName							screenName of the user
 * @param {string} sourceFunc							function from where the call if done
 * @param {object} data										the data object for plotline
 * @param {object} data.data							data to send to plotline
 * @param {object} data.config						config for the call
 * @param {boolean} isEnabled							whether protocol is enabled
 * 
 * @returns {Promise.<boolean>}
 **/

const sendPlotlineData = async (screenName, sourceFunc, plotlineData, protocolsConfig) => {
	console.log("***** STOPPED sendPlotlineData ****")
	// console.log(screenName, 'Inside sendPlotlineData sourceFunc:', sourceFunc)

	// const defaultConfig = protocolsConfig.plotlineConfig
	// const plotlineHeaders = {
	// 	'Content-type': 'application/json',
	// 	'api-key': getEnv('PLOTLINE_APIKEY')
	// }

	// const plotlineEventwiseConfig = protocolsConfig.plotlineEventwiseConfig

	// const userPropsApiKeyWiseData = {}
	// // Process data if it's an array
	// if (Array.isArray(plotlineData?.data?.d) && plotlineData?.data?.d?.length) {
	// 	for (const userData of plotlineData.data.d) {
	// 		if (userData.type === 'identify') {
	// 			processIdentifyData(userData, userPropsApiKeyWiseData, plotlineEventwiseConfig)
	// 		} else if (userData.type === 'track') {
	// 			processTrackData(userData, userPropsApiKeyWiseData, plotlineEventwiseConfig)
	// 		}
	// 	}
	// } else {
	// 	const type = plotlineData?.data?.type
	// 	console.log('type:', type)
	// 	if (type === 'identify') {
	// 		processIdentifyData(plotlineData.data, userPropsApiKeyWiseData, plotlineEventwiseConfig)
	// 	} else if (type === 'track') {
	// 		processTrackData(plotlineData.data, userPropsApiKeyWiseData, plotlineEventwiseConfig)
	// 	}
	// }
	// // Make network calls for each API key
	// for (const [apiKey, userDataArray] of Object.entries(userPropsApiKeyWiseData)) {
	// 	plotlineHeaders['api-key'] = process.env[apiKey]
	// 	console.log('Making network call for API Key:', apiKey)
	// 	// Chunk userDataArray into batches of 10 and make API calls for each chunk
	// 	const chunkSize = 10
	// 	for (let i = 0; i < userDataArray.length; i += chunkSize) {
	// 		const chunk = userDataArray.slice(i, i + chunkSize)
	// 		// console.log('Processing chunk:', chunk)
	// 		let res = await makeNetworkCall(screenName, sourceFunc, 'plotline', defaultConfig, { data: chunk }, plotlineHeaders)
	// 		console.log('Response from Plotline API for chunk:', res)
	// 	}
	// }
	return true
}
// Helper function to process "identify" type data
const processIdentifyData = (userData, userPropsApiKeyWiseData, plotlineEventwiseConfig) => {
	const usrAttrChannel = userData?.context?.traits?.channel
	const filteredConfig = plotlineEventwiseConfig.find(config =>
		config.channel.includes(usrAttrChannel)
	)

	if (filteredConfig) {
		const validTraits = {}
		const traits = userData?.context?.traits
		const userPropsList = filteredConfig.userPropsList

		// Filter traits based on userPropsList
		if (userPropsList.length) {
			for (const key in traits) {
				if (userPropsList.includes(key)) {
					validTraits[key] = traits[key]
				}
			}
		}
		console.log('validTraits object after validating userProps:', validTraits)
		userData.context.traits = validTraits

		// Group data by API keys
		const userPropsApiKeys = filteredConfig.userPropsApiKeys
		if (userPropsApiKeys.length) {
			for (const apiKey of userPropsApiKeys) {
				if (!userPropsApiKeyWiseData[apiKey]) {
					userPropsApiKeyWiseData[apiKey] = []
				}
				userPropsApiKeyWiseData[apiKey].push(userData)
			}
		}
	}
	console.log('userPropsApiKeyWiseData', userPropsApiKeyWiseData)
}

// Helper function to process "track" type data
const processTrackData = (userData, userPropsApiKeyWiseData, plotlineEventwiseConfig) => {
	const targetChannel = userData?.properties?.channel
	const targetEvent = userData?.event

	const filteredConfig = plotlineEventwiseConfig.find(config =>
		config.channel.includes(targetChannel)
	)

	if (filteredConfig) {
		const eventsApiKeys = filteredConfig.eventsApiKeys
		console.log('eventsApiKeys:', eventsApiKeys)
		// Group data by API keys if event is enabled
		if (filteredConfig.enableForAll || filteredConfig.events.includes(targetEvent)) {
			for (const apiKey of eventsApiKeys) {
				if (!userPropsApiKeyWiseData[apiKey]) {
					userPropsApiKeyWiseData[apiKey] = []
				}
				userPropsApiKeyWiseData[apiKey].push(userData)
			}
		}
	}
}
/**	
 * Function for sending the formatting and sending the EMS websocket call
 * @param {string} screenName							screenName of the user
 * @param {string} sourceFunc							function from where the call if done
 * @param {object} data										the data object for ems websocket
 * @param {object} data.data							data to send to ems websocket
 * @param {object} data.config						config for the call
 * @param {boolean} isEnabled							whether protocol is enabled
 * 
 * @returns {Promise.<boolean>}
 **/
const sendWebsocketData = async (screenName, sourceFunc, data, protocolsConfig) => {
	let defaultConfig = protocolsConfig.websocketConfig

	return makeNetworkCall(screenName, sourceFunc, 'websocket', defaultConfig, data)
		.then(() => true)
}


/**	
 * Unified function for sending the protocols
 * @param {string} screenName																									screenName of the user
 * @param {string} sourceFunc																									function from where the call if done
 * @param {object} dataToProtocols																						the data object
 * @param {object} dataToProtocols.ctData																			the object containing ct data
 * @param {object} dataToProtocols.ctData.data																ct data
 * @param {object} dataToProtocols.ctData.config															ct config
 * @param {boolean} dataToProtocols.ctData.config.retry												retry true/false
 * @param {object} dataToProtocols.emsData																		the object containing ems oracle data
 * @param {object} dataToProtocols.emsData.data																ems oracle data
 * @param {object} dataToProtocols.emsData.config															ems oracle config
 * @param {boolean} dataToProtocols.emsData.config.retry											retry true/false
 * @param {object} dataToProtocols.inventoryData															the object containing ems inventory data
 * @param {object} dataToProtocols.inventoryData.data													ems inventory data
 * @param {object} dataToProtocols.inventoryData.config												ems inventory config
 * @param {boolean} dataToProtocols.inventoryData.config.retry								retry true/false
 * @param {object} dataToProtocols.analyticsData															the object containing ems analytics data
 * @param {object} dataToProtocols.analyticsData.data													ems analytics data
 * @param {object} dataToProtocols.analyticsData.config												ems analytics config
 * @param {boolean} dataToProtocols.analyticsData.config.retry								retry true/false
 * @param {object} dataToProtocols.plotlineData																the object containing plotline data
 * @param {object} dataToProtocols.plotlineData.data													plotline data
 * @param {object} dataToProtocols.plotlineData.config												plotline config
 * @param {boolean} dataToProtocols.plotlineData.config.retry									retry true/false
 * @param {object} dataToProtocols.websocketData															the object containing websocket data
 * @param {object} dataToProtocols.websocketData.data													ems websocket data
 * @param {object} dataToProtocols.websocketData.config												ems websocket config
 * @param {boolean} dataToProtocols.websocketData.config.retry								retry true/false
 * 
 * @returns {Promise.<boolean>}
 **/
exports.sendProtocols = async (screenName, sourceFunc, dataToProtocols) => {
	console.log(screenName, sourceFunc, 'calling sendProtocols function')
	try {
		await sendProtocolsValidation(screenName, sourceFunc, dataToProtocols)

		let protocolsConfig = await findOneCache('settings', { _id: 'pf-sendProtocol-config', type: 'protocols' })
		// initialising the return data object
		let returnData = {}

		// list of protocols to be sent
		let reqKeys = Object.keys(dataToProtocols)

		// mapping object for function and enabled key
		let mapObject = {
			'ctData': sendCtData,
			'emsData': sendEmsData,
			'inventoryData': sendInvData,
			'analyticsData': sendAnalyticsData,
			'plotlineData': sendPlotlineData,
			'websocketData': sendWebsocketData,
			'mixPanelData': sendMixPanelData,
		}

		await Promise.allSettled(reqKeys
			.map(keys => mapObject[keys](screenName, sourceFunc, dataToProtocols[keys], protocolsConfig)))
			.then((resp) => {
				for (let i = 0; i < resp.length; i++) {
					if (resp[i]?.value?.error) resp[i].value.error = resp[i].value.error.message
					if (resp[i]?.reason) {
						resp[i].value = resp[i].reason.message
						delete resp[i].reason
					}
					returnData[reqKeys[i]] = resp[i]
				}
				console.log(screenName, sourceFunc, 'Result of all the sendProtocols calls:', returnData)
			})

		return returnData
	} catch (error) {
		console.error(screenName, sourceFunc, 'error in sendProtocols function:', error.message)
		return { error: { message: error.message, status: 1000 } }
	}
}