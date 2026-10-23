/**
 * Checks TDS (Tax Deducted at Source) eligibility for a user based on their subscription type,
 * configuration limits, and financial year data.
 *
 * @async
 * @function tdsEligibilityForUser
 * @param {Object} decoded - Decoded user information, typically containing user ID and channel.
 * @param {Object} user - User object containing subscriptionType, screenName, win, oemId, manualRedeemFlag, and other metadata.
 * @returns {Promise<boolean>} - Returns true if the user is eligible for TDS, otherwise false.
 */

/**
 * Fetches configuration data required for TDS eligibility calculation, including global config,
 * user metadata, wt level config, and OEM config if applicable.
 *
 * @async
 * @function fetchConfigs
 * @param {Object} decoded - Decoded user information, typically containing user ID and channel.
 * @param {Object} user - User object containing oemId and other metadata.
 * @returns {Promise<Object>} - Returns an object containing redeemGlobalConfig, userMetadata, wtConfig, and isOemValid.
 */

/**
 * Determines the selected configuration for redeem limits based on user, wt level, OEM validity,
 * and custom user-specific limits.
 *
 * @async
 * @function setSelectedConfig
 * @param {Object} user - User object containing _id, screenName, manualRedeemFlag, and other metadata.
 * @param {Object} wtConfig - wt level configuration object.
 * @param {boolean} isOemValid - Flag indicating if OEM config is valid for the user.
 * @param {Object} oemMasterConfig - OEM master configuration object.
 * @returns {Promise<Object>} - Returns the selected configuration object for redeem limits.
 */

/**
 * Fetches the TDS calculation SK (sort key) for the current financial year based on global config.
 *
 * @async
 * @function fetchTdsSk
 * @returns {Promise<string>} - Returns the SK string for TDS calculation data for the current or previous financial year.
 */
const { core, findOne } = require('new-dynamo-wrapper')


exports.tdsEligibilityForUser = async (decoded, user) => {
	try {

		let tdsEligibilityFlag = false
		console.log('Fetching TDS eligibility for user:', decoded._id)
		if (user?.subscriptionType !== 'premium') {
			console.log(`${user.screenName}: User is not premium, skipping TDS eligibility check.`)
			return false
		}
		let {
			redeemGlobalConfig,
			userMetadata, wtConfig, isOemValid } = await this.fetchConfigs(decoded)

		let selectedConfig = await this.setSelectedConfig(user, wtConfig, isOemValid, redeemGlobalConfig)
		console.log('Selected Config:', selectedConfig)


		let maxStandardRedeem = selectedConfig.standardRedeemConfig.maxAmountPerRequest
		let maxInstantRedeem = selectedConfig.instantRedeemConfig.maxAmountPerRequest
		let maxPaidInstantRedeem = selectedConfig?.paidInstantConfig?.maxAmountPerRequest || 0

		let standardFlag = false
		if (selectedConfig.standardRedeemConfig?.standardDisableFlag != null) {
			standardFlag = !selectedConfig.standardRedeemConfig.standardDisableFlag && redeemGlobalConfig.standardEnableFlag
		} else {
			standardFlag = redeemGlobalConfig.standardEnableFlag
		}

		let instantFlag = false
		if (selectedConfig.instantRedeemConfig?.instantDisableFlag != null) {
			instantFlag = !selectedConfig.instantRedeemConfig.instantDisableFlag && redeemGlobalConfig.instantEnableFlag
		} else {
			instantFlag = redeemGlobalConfig.instantEnableFlag
		}

		let paidInstantFlag = false
		if (selectedConfig.paidInstantConfig?.paidInstantDisableFlag != null) {
			paidInstantFlag = !selectedConfig.paidInstantConfig.paidInstantDisableFlag && redeemGlobalConfig.paidInstantEnableFlag
		} else {
			paidInstantFlag = redeemGlobalConfig.paidInstantEnableFlag
		}



		let amounts = []

		if (standardFlag) amounts.push(maxStandardRedeem)
		if (instantFlag) amounts.push(maxInstantRedeem)
		if (paidInstantFlag) amounts.push(maxPaidInstantRedeem)
		let winBucketPercentageConsideration = (redeemGlobalConfig?.winBucketPercentageConsideration || 50) / 100
		let winBucket = (user?.win) * winBucketPercentageConsideration
		amounts.push(winBucket)
		let minAmount = amounts.length > 0 ? Math.min(...amounts) : 0

		let openingBalanceFinyear = userMetadata?.openingBalanceFinyear || 0
		let cummulativePurchaseFinyear = userMetadata?.cummulativePurchaseFinyear || 0
		let cummulativeRedeemFinyear = userMetadata?.cummulativeRedeemFinyear || 0
		let taxedNetWinnings = userMetadata?.taxedNetWinnings || 0
		let tdsFreeAmount = (openingBalanceFinyear + cummulativePurchaseFinyear + taxedNetWinnings) - cummulativeRedeemFinyear
		if (minAmount >= tdsFreeAmount) tdsEligibilityFlag = true

		return tdsEligibilityFlag

	} catch (error) {
		console.error('Error fetching TDS eligibility:', error.message)
		return false
	}
}

exports.fetchConfigs = async (decoded, user) => {

	console.log('Inside fetchConfigs:', decoded._id)


	let tdsSk = await this.fetchTdsSk()

	// Batch get parameters
	const batchParams = {
		RequestItems: {
			wt_config: {
				Keys: [
					{ _id: 'pf-redeem-global-config', s_key: 'redeemaddcash' }
				]
			},
			wt_level_changes: {
				Keys: [{ userId: decoded._id }]
			},
			users_metadata: {
				Keys: [
					{ pk: `user#${decoded._id}`, sk: tdsSk }
				]
			}
		}
	}

	const response = await core('batchGet', batchParams)

	let wtLevelChanges = response?.Responses?.wt_level_changes?.[0]

	let redeemGlobalConfig = response?.Responses?.wt_config?.[0]

	let userMetadata = response?.Responses?.users_metadata?.[0]

	let wtConfig = await findOne('wt_config', { _id: 'pf-redeem-limit-wtlevel-config', s_key: wtLevelChanges.currentWtLevelName })
	let oemMasterData
	let isOemValid = false
	if (user?.oemId) {
		oemMasterData = (await findOne('settings', {
			_id: 'pf-redeem-limit-oem-config',
			type: user.oemId
		}))[0]
		if (oemMasterData?.redeemsAllowed?.includes(decoded.channel)) {
			redeemGlobalConfig = oemMasterData
			isOemValid = true
		}
	}

	return {
		redeemGlobalConfig,
		userMetadata,
		wtConfig,
		isOemValid
	}
}

exports.setSelectedConfig = async (user, wtConfig, isOemValid, oemMasterConfig) => {
	console.log(user.screenName, 'inside set selected config')
	let selectedConfig = {}
	let wtConfigUser = wtConfig

	let customConfig = await findOne('user_redeem_limits', { userID: user._id, type: 'redeemlimit' })
	// let redeemGlobalConfig = await findOne('wt_config', { _id: 'pf-redeem-global-config', s_key: 'redeemaddcash' })
	// let redeemGlobalConfig = oemMasterConfig // in oemMasterConfig we will have Global config for WT user and oemConfig for OEM user

	if (isOemValid && !(user.manualRedeemFlag && customConfig?.startAt < +new Date() && customConfig?.endAt > +new Date())) {
		selectedConfig = oemMasterConfig
		console.log(user.screenName, ' user coming to OEM configs master')
	} else if (user.manualRedeemFlag && customConfig?.startAt < +new Date() && customConfig?.endAt > +new Date()) {
		console.log(user.screenName, 'user.manualRedeemFlag is true , finding user redeem limits in user_redeem_limits')

		selectedConfig = customConfig
		selectedConfig.rgLimitUpdated = true
		selectedConfig.auto_aprvl_lmt = customConfig.standardRedeemConfig.autoApprovalLimit
	} else {
		console.log(user.screenName, 'user.manualRedeemFlag is false , setting user limit by comparing wt_level ')
		selectedConfig = wtConfigUser
	}

	// if (customConfig?.instantDisableFlag)
	//   selectedConfig.instantRedeemConfig = isOemValid ? oemMasterConfig.instantRedeemConfig : wtConfigUser.instantRedeemConfig

	// if (customConfig?.standardDisableFlag)
	//   selectedConfig.standardRedeemConfig = isOemValid ? oemMasterConfig.standardRedeemConfig : wtConfigUser.standardRedeemConfig

	// if (redeemGlobalConfig.paidInstant.enableFlag) {
	//   if (redeemGlobalConfig.paidInstant.userSpecificPaidInstant) {
	//     if (customConfig?.paidInstantDisableFlag || customConfig?.paidInstantDisableFlag === undefined ||
	//       (customConfig && (customConfig?.endAt < +new Date() || customConfig?.startAt > +new Date()))) {
	//       delete selectedConfig?.paidInstantConfig
	//     }
	//   } else {
	//     if (customConfig?.paidInstantDisableFlag && customConfig?.startAt < +new Date() && customConfig?.endAt > +new Date()) {
	//       delete selectedConfig?.paidInstantConfig
	//     } else if (customConfig?.paidInstantDisableFlag === undefined) {
	//       selectedConfig.paidInstantConfig = isOemValid ? oemMasterConfig.paidInstantConfig : wtConfigUser.paidInstantConfig
	//     }
	//   }
	// }

	// if (customConfig && customConfig?.startAt < +new Date() && customConfig?.endAt > +new Date()) {
	//   selectedConfig.instantDisableFlag = customConfig?.instantDisableFlag
	//   selectedConfig.standardDisableFlag = customConfig?.standardDisableFlag
	//   selectedConfig.paidInstantDisableFlag = customConfig?.paidInstantDisableFlag
	// }

	// selectedConfig.instantRedeemConfig.cancellationWindowInstantMinutes = wtConfigUser?.instantRedeemConfig?.cancellationWindowInstantMinutes

	console.log(user.screenName, 'selectedConfig')

	return selectedConfig
}

exports.fetchTdsSk = async () => {
	let { tdsFinancialYearMonth } = await findOne('wt_config', { _id: 'pf-redeem-global-config', s_key: 'redeemaddcash' })
	if (new Date().getMonth() <= tdsFinancialYearMonth && new Date().getFullYear() === 2024) return 'tdsCalculationData'
	if (new Date().getMonth() > tdsFinancialYearMonth) return `tdsCalculationData${new Date().getFullYear()}`
	if (new Date().getMonth() <= tdsFinancialYearMonth) return `tdsCalculationData${new Date().getFullYear() - 1}`
}