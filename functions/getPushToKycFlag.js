const { core, find, findOneCache } = require('new-dynamo-wrapper')
const { EDIntegration } = require('./EDIntegration')


/**
 * Function for getting the push to kyc flag
 * @param {object} user user object
 * @param {string} channel channel from which the user is logging in
 * @param {object} unifiedKycConfig the unified kyc config
 * @param {boolean} isTNUser If the user is from TN. By default, it is false and the gps checks will be done to check if the user is from TN.
 * If it is sent as true, it will override the gps checks and proceed directly to the other checks.
 * 
 * @returns {Promise<boolean>} pushToKYC flag
 */
exports.getPushToKycFlag = async (user, channel, unifiedKycConfig, isTNUser) => {
	try {
		// fetching the unified kyc config
		if (!unifiedKycConfig) unifiedKycConfig = await findOneCache('wt_config', { _id: 'pf-kyc-verification-config', s_key: 'kyc-unified-config' })

		console.log(channel, 'disablePreKyc:', unifiedKycConfig?.disablePreKyc)
		if (unifiedKycConfig?.disablePreKyc && channel === 'GAPS') {
			channel = 'APS'
			console.log(channel, 'changed channel')
		}
		// checking if the user is registered after the compliance start date
		const isUserRegisteredAfterCompliance = ((user.wtRegDate || user.createdAt) > unifiedKycConfig.stateComplianceConfig.complianceStartDate)
		console.log(`${user.screenName} - isUserRegisteredAfterCompliance: ${isUserRegisteredAfterCompliance}. User registration date: ${new Date(user.wtRegDate || user.createdAt).toISOString()}. Compliance start date: ${new Date(unifiedKycConfig.stateComplianceConfig.complianceStartDate).toISOString()}`)

		// if the isTNUser flag is not sent, we check if the user is from TN
		if (typeof isTNUser === 'undefined') {
			console.log(user.screenName, 'isTNUser flag not sent. Checking if the user is from TN')
			isTNUser = await this.isUserFromTN(user)
		}

		// if the master flag is disabled or the user is registered before the compliance start date, we set the isTNUser flag as false
		if (!(unifiedKycConfig.stateComplianceConfig.masterFlag && isUserRegisteredAfterCompliance)) {
			console.log(user.screenName, 'Master flag is disabled or user registered before compliance start date. Setting isTNUser as false')
			isTNUser = false
		}

		// getting the push to kyc flag
		const pushToKYC = this.getPushToKycTN(user.screenName, channel, isTNUser, user.panApproved, user.kycDocStatus, user.kycDocApprovedBy, unifiedKycConfig)

		console.log(user.screenName, 'Push to KYC flag:', pushToKYC)
		return pushToKYC
	} catch (error) {
		console.error(user.screenName, 'Error in getPushToKycFlag', error)
		return false
	}
}

/**
 * Function for getting the pushToKyc flag
 * @param {string} screenName Screen name of the user
 * @param {string} channel Channel from where the user is playing
 * @param {boolean} isTNUser Flag to check if the user is from TN
 * @param {boolean} panApproved Flag to check if the user is PAN approved
 * @param {string} kycDocStatus Current doc status. Values can be 'approved', 'rejected' or 'processing'
 * @param {string} kycDocApprovedBy How the user was approved
 * @param {object} unifiedKycConfig the unified kyc config
 * @returns {boolean} Returns true if the user needs to be pushed to KYC, else false
 */
exports.getPushToKycTN = (screenName, channel, isTNUser, panApproved, kycDocStatus, kycDocApprovedBy, unifiedKycConfig) => {
	// logging the params
	console.log(`${screenName} in getPushToKycTN: channel=${channel}, isTNUser=${isTNUser}, panApproved=${panApproved}, kycDocStatus=${kycDocStatus}, kycDocApprovedBy=${kycDocApprovedBy}`)

	// flag for kyc verified
	const isUserKycVerified = panApproved || (kycDocStatus === 'approved')

	// flag for kyc verified by OTP
	const isUserVerifiedByOTP = kycDocStatus === 'approved' && unifiedKycConfig.stateComplianceConfig.allowedVerificationModes?.includes(kycDocApprovedBy)

	let pushToKYC
	if (channel === 'GAPS') {
		// if the channel is GAPS, we will push the user to KYC if the user is not KYC verified
		pushToKYC = !isUserKycVerified

		// if the user is not KYC verified, we set the pushToKYC flag as true for GAPS channel
		if (pushToKYC) {
			console.log(screenName, channel, 'User from GAPS. KYC not verified. Setting pushToKYC as true')
			return true
		}

		// if the user is kyc verified, we check if the user is from TN and the user is not approved using the configured values
		// in this case, we set the pushToKYC flag as true. else, we don't change the flag and it will remain false.
		if (!pushToKYC && isTNUser && !isUserVerifiedByOTP) {
			console.log(screenName, channel, 'User from TN and GAPS, but not kyc approved using configured methods. Setting pushToKYC as true')
			return true
		}
	} else if (isTNUser) {
		// for other channels, if the user is from TN and is not approved using the configured values, then we push the user to KYC
		console.log(screenName, channel, 'User from non-GAPS channel and TN. Setting pushToKYC as', !isUserVerifiedByOTP)
		return !isUserVerifiedByOTP
	} else {
		// for non-GAPS channels who are not from TN, we send the pushToKYC flag as false
		console.log(screenName, channel, 'Not from TN. Setting pushToKYC as false')
		return false
	}

	return false
}

/**
 * Function for checking if the user is from TN
 * @param {object} user user object
 * @returns {Promise<boolean>} if the user is from TN
 */
exports.isUserFromTN = async (user) => {
	try {
		// if test account, we allow the without gps checks
		if (['testaccount', 'testAccount'].includes(user.playerStatus)) {
			console.log(user.screenName, 'Test account, sending isUserFromTN as false')
			return false
		}

		// setting the start date for fetching the gps checks record
		const startDate = +new Date() - 12 * 60 * 60 * 1000

		// fetching the latest gps checks record for the user
		const params = {
			TableName: 'gps_checks',
			KeyConditions: {
				_id: { ComparisonOperator: 'EQ', AttributeValueList: [user._id] },
				createdAt: { ComparisonOperator: 'BETWEEN', AttributeValueList: [startDate, +new Date()] }
			},
			ScanIndexForward: false,
			Limit: 1,
			ConsistentRead: true
		}
		const lastGPSDetails = await core('query', params)

		// getting the latest gps checks record if it exists
		const latestGPSDetails = lastGPSDetails?.Count ? lastGPSDetails?.Items[0] : {}

		// if the gps checks record does not exist, we return false
		if (!lastGPSDetails?.Count) {
			console.log(user.screenName, 'GPS checks record not found, sending isUserFromTN as false')
			return false
		}

		// if the gps checks record is found, we log it
		console.log(user.screenName, 'GPS checks record found. Encrypted state:', latestGPSDetails.gpsState_encrypted)

		// decrypting the gps state record
		const gpsStateRecord_decrypted = await EDIntegration('decrypt', latestGPSDetails, 'getProfilev2', 'platform-user')

		// setting gps state value as gpsState_encrypted
		let gpsState = gpsStateRecord_decrypted.gpsState_encrypted

		// if the gpsState is undefined, it means the gps state is not available
		// in this case, we check if the state details are available (lat long or IP state)
		// if it is available, we set the gpsState as that
		if (!gpsState) {
			if (!['na', 'not found'].includes(gpsStateRecord_decrypted.state_encrypted || 'na')) {
				gpsState = gpsStateRecord_decrypted.state_encrypted
			} else {
				gpsState = 'na'
			}
		}

		// getting the state code config
		const statesTableRecord = await find('states', { stateName: gpsState }, 'stateName-index')

		// if the state is not present in the states table, we allow it
		if (!statesTableRecord.length) {
			console.log(user.screenName, 'State not found in states table, sending isUserFromTN as false')
			return false
		}

		// if the state code is TN, we return true
		console.log(user.screenName, 'State found in states table:', statesTableRecord[0].stateCode)
		return (statesTableRecord[0].stateCode === 'TN')
	} catch (error) {
		// if there is an error, we log it and don't ask for state compliance
		console.log(user.screenName, 'Error in isUserFromTN:', error)
		return false
	}
}