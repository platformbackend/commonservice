const { findOneCache } = require('new-dynamo-wrapper')

const DEFAULT_TABLE_NAME = 'user_wallet'
const SETTINGS_TABLE = 'settings'

// taking average days as 31 instead of decimal
const DEFAULT_TTL_6_MONTHS_IN_SECONDS = 86400 * 31 * 6

const DEFAULT_USER_WALLET_CONFIG = {
	tableName: DEFAULT_TABLE_NAME,
	ttl: DEFAULT_TTL_6_MONTHS_IN_SECONDS
}

exports.getUserWalletTableConfig = async (service = 'platform-common') => {
	try {
		console.log(`Fetching user wallet config for ${service}`)

		const userWalletConfig = await findOneCache(
			SETTINGS_TABLE,
			{ _id: 'table_config', type: 'user_wallet_ttl_config' }, { table_name: 1, ttl: 1 }
		)

		console.log('User Wallet Config from Database', userWalletConfig)

		if (userWalletConfig) {
			const userWalletResponse = {
				tableName: userWalletConfig.table_name ?? DEFAULT_TABLE_NAME,
				ttl: userWalletConfig.ttl ?? DEFAULT_TTL_6_MONTHS_IN_SECONDS
			}

			console.log('returning table name and ttl for user wallet', userWalletResponse)

			return userWalletResponse
		} else {
			console.warn('User Wallet Config not found in database returning default')
			return DEFAULT_USER_WALLET_CONFIG
		}
	} catch (error) {
		console.error('Failed to fetch user wallet config returning default config', error)
		return DEFAULT_USER_WALLET_CONFIG
	}


}