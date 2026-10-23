const axios = require('axios')
const { getEnv } = require('./getEnv')

exports.sendToClevertap = async (data) => {
	try {
		console.log("***** STOPPED sendToClevertap ****")
		return true
		let url = getEnv('CT_EVENTCALL_URL')
		const headers = {
			'Content-Type': 'application/json',
			'X-CleverTap-Account-Id': getEnv('PROJECT_ID'),
			'X-CleverTap-Passcode': getEnv('PASSCODE')
		}
		const response = await axios.post(url, data, { headers: headers }, { timeout: 200 })
		console.log(response.data)
		return response.data

	} catch (error) {
		// handle axios errors
		// if (error.response) console.log('error.response', error.response.data)
		// else if (error.request) console.log('error.request', error.request)
		console.log('Error', error.message)
		return false
	}
}



