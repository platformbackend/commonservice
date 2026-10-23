const axios = require('axios')
const {findOneCache, findOne } = require('new-dynamo-wrapper')
const { getEnv } = require('./getEnv')



const fraudCheckApi = async(user, redeemConfig, wtLevelConfig) => {
	try {
		const reqBody = {
			playerId: user.screenName,
			wtLevel: wtLevelConfig?.currentWtLevel || 0
		}
	
		const riskScoreResponse = await axios.post(getEnv('RISKSCORE_URL'), reqBody, {
			auth: {
				username: getEnv('RISKSCORE_USERNAME'),
				password: getEnv('RISKSCORE_PASSWORD')
			},
			timeout: 2000
		})
		const isFraud = riskScoreResponse?.data?.riskScore > redeemConfig?.riskScoreThreshold

		console.log(user.screenName, 'isFraud:', isFraud, 'riskScoreResponse:', riskScoreResponse, 'max riskScore threshold:', redeemConfig?.riskScoreThreshold)

		return isFraud
	} catch (error) {
		// Log the error and treat as fraud for safety
		console.error(user.screenName, 'Error in fraudCheckApi:', error?.response?.status, error?.message)
		return false
	}
}

exports.redeemCheckerFlag = async (userId, config, wtLevelConfig) => {
	try {
		const user = await findOne('users', { _id: userId })

		if(!user) {
			console.error('User not found for userId:', userId)
			throw new Error('User not found')
		}

		console.log(user.screenName, 'Redeem Checks Start')

		if (!config) {
			const { redeemConfig } = await findOneCache('wt_config', { _id: 'pf-kyc-verification-config', s_key: 'kyc-unified-config' })
			config = redeemConfig
		}

		if(!wtLevelConfig){
			wtLevelConfig = await findOne('wt_level_changes', { 'userId': userId }, {'currentWtLevel': 1})
		}

		//Fraud check: true if fraud, false otherwise
		const isFraud = await fraudCheckApi(user, config, wtLevelConfig)

		console.log(user.screenName, 'totalRedeemCount:', user?.totalRedeemCount, 'maxNumberOfRedeemsAllowed:', config?.maxNumberOfRedeems)

		const isRedeemLimitReached = (user?.totalRedeemCount >= (config.maxNumberOfRedeems))

		console.log(user.screenName, 'Redeem Checks:', { isFraud, isRedeemLimitReached })

		return {
			isFraud,
			isRedeemLimitReached
		}
	}catch (error) {
		// if there is an error, we log it and don't ask for state compliance
		console.error(userId, 'Error in Redeem Checks:', error?.message)
		return {
			isFraud: true,
			isRedeemLimitReached: true
		}
	}

}
