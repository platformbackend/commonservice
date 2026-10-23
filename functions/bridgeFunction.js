const { findOneCache, find } = require('new-dynamo-wrapper')
const axios = require('axios')
const { urls } = require('../config/envUrls')
const envUrl = urls[process.env.NODE_ENV]?.PAYU_URL
exports.bridgeFunction = async (screenName, feature, dataPoints) => {
	try {
		console.log('inside payu validation', screenName)
		let rstsConfigs = await findOneCache('settings', { _id: 'pl_node_rsts_config', type: 'rsts' })
		if (feature === 'payU') {
			console.log(screenName, 'feature is payu')
			await payuHandler(screenName, dataPoints, rstsConfigs)
			return true
		}
		console.log('no feature implemented for', screenName)
		return true
	}
	catch (e) {
		console.log(screenName, 'error in bridgeFunction', e)
		return true
	}

}

const payuHandler = async (screenName, dataPoints, rstsConfigs) => {
	console.log(screenName, 'inside payu handler')
	if (dataPoints.addCashPayU) {
		let { payU: { addCash: {
			addCashCount,
			depositlowerValue,
			depositHigherValue,
			stateCodesWhitelisted,
			addCashFeatureFlag = true
		} } } = rstsConfigs

		let depositAmount = dataPoints?.addCashPayU?.totalDepositsAmount
		let gpsState = dataPoints?.addCashPayU?.gpsState
		let depositCount = dataPoints?.addCashPayU?.totalDepositsCount

		let channel = dataPoints?.addCashPayU?.channel
		console.log('gps state is', gpsState)
		let depositCountFlag = depositCount ? depositCount == addCashCount : true
		let depositAmountFlag = (depositlowerValue && depositHigherValue) ? (depositAmount <= depositHigherValue && depositAmount >= depositlowerValue) : true
		let stateCodes = await find('states', { stateName: gpsState || 'a' }, 'stateName-index')
		console.log('state codes are', stateCodes)
		let stateCode = stateCodes[0]?.stateCode
		console.log('state code is', stateCode)
		let stateCodeFlag = stateCodesWhitelisted ? stateCodesWhitelisted.includes(stateCode) : true
		if (depositCountFlag && depositAmountFlag && stateCodeFlag && addCashFeatureFlag) {
			console.log(screenName, 'calling payu api for this user for add cash')
			await axios.post(envUrl,
				{ screenName: screenName,
					channel,
					location: 'conversion'  },
				{ timeout: 1000 })
		}
	}
	if (dataPoints.signupPayu) {
		console.log(screenName,'inside signup payu')
		let { payU: { signup: {
			signupFeatureFlag,
			disableEpoch
		} } } = rstsConfigs

		if (!signupFeatureFlag || +new Date() > disableEpoch) return true

		await axios.post(envUrl,
			{ screenName: screenName, 
				location: 'signup' ,
				channel: dataPoints?.signupPayu?.channel || 'NA'
			},
			{ timeout: 1000 })
	}
}