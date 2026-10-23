const { findOneCache } = require('new-dynamo-wrapper')
const { compareTwoStrings } = require('string-similarity')

const configMap = async (type) => {
	if (type === 'upi') {
		return {
			wtConfig: { _id: 'pf-redeem-name-match-config', s_key: 'upi' }
		}
	} else if (type === 'bank') {
		return {
			wtConfig: { _id: 'pf-redeem-name-match-config', s_key: 'bankAccountMatch' }
		}
	}
}

const getMatchResult = async (user, name, type) => {

	const { wtConfig } = await configMap(type)
	const [wtConfigData, unifiedKycConfig] = await Promise.all([
		findOneCache('wt_config', wtConfig),
		findOneCache('wt_config', { _id: 'pf-kyc-verification-config', s_key: 'kyc-unified-config' })
	])

	console.log(user.screenName, 'fetched configs successfully')

	let kycMatchScore = 0
	let panMatchScore = 0

	const userRegistrationDate = user.wtRegDate || user.createdAt
	const configStartDateForRedeemChecks = unifiedKycConfig?.redeemConfig?.configDate

	console.log(user.screenName, 'userRegistrationDate=', new Date(userRegistrationDate).toISOString(), 'configStartDateForRedeemChecks=', new Date(configStartDateForRedeemChecks).toISOString())

	const allowedModesKycStatus = (userRegistrationDate > configStartDateForRedeemChecks) && unifiedKycConfig?.redeemConfig?.allowedVerificationModes?.includes(user.kycDocApprovedBy)
	const redeemKycApproved = Boolean(user.kycDocStatus === 'approved' && allowedModesKycStatus)

	console.log(user.screenName, 'panApproved=', user.panApproved, 'kycDocStatus=', user.kycDocStatus, 'redeemKycApproved=', redeemKycApproved)

	if (redeemKycApproved) {
		kycMatchScore = Math.floor( compareTwoStrings(user?.kycUserName_encrypted.toLowerCase(), name.toLowerCase()) * 100 )
		console.log(user.screenName, 'kycMatchScore:', kycMatchScore)
	}
	if (user?.panName_encrypted) {
		panMatchScore = Math.floor( compareTwoStrings(user?.panName_encrypted.toLowerCase(), name.toLowerCase()) * 100 )
		console.log(user.screenName, 'panMatchScore:', panMatchScore)
	}

	const highestMatchScore = Math.max(kycMatchScore, panMatchScore)
	console.log(user.screenName, 'highestMatchScore:', highestMatchScore)

	const matchedWith = highestMatchScore === kycMatchScore ? 'kyc' : 'pan'
	console.log(user.screenName, 'matchedWith:', matchedWith)

	const matchNameConfig = wtConfigData['matchTypeConfig']
	const matchedfromConfig = matchNameConfig.find(
		(item) => highestMatchScore <= item.rvalue && highestMatchScore >= item.lvalue
	)
	const matchName = matchedfromConfig?.matchName
	const action = matchedfromConfig?.action
	console.log(user.screenName, 'matchName:', matchName, 'action:', action)

	return { action, matchName, highestMatchScore, matchedWith }
}

/**
 * Checks the name match for redemption based on user data and type.
 * @async
 * @param {Object} user - The user object containing relevant information.
 * @param {string} name - The bank name to be matched.
 * @param {string} type - The type of redemption ('upi' or 'bank').
 * @returns {Promise<Object>} The result of the name match check.
 * @throws {Error} Throws error if the type is invalid or if any internal error occurs.
 */
exports.redeemNameMatchCheck = async (user, name, type) => {
	try {
		console.log(user.screenName, 'inside redeemNameMatchCheck:', type)

		if (!['upi', 'bank'].includes(type)) {
			throw new Error('Invalid type')
		}

		return await getMatchResult(user, name, type)

	} catch (error) {
		console.error(user.screenName, 'error in redeemNameMatchCheck:', error?.message)
		throw error
	}
}
