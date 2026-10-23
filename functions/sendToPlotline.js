const axios = require('axios')
const { getEnv } = require('./getEnv')

exports.sendToPlotline = async (data) => {
	try {
		return true
		console.log('inside sendToPlotline, url: ', getEnv('PLOTLINE_URL'))
		let url = getEnv('PLOTLINE_URL')

		const headers = {
			'Content-type': 'application/json',
			'api-key': getEnv('PLOTLINE_APIKEY'),
		}
		const response = await axios.post(url, data, { 'headers': headers })
		console.log('plotline response data', response.data)
		return response.data

	} catch (error) {
		// handle axios errors
		// if (error.response) console.log('error.response', error.response.data)
		// else if (error.request) console.log('error.request', error.request)
		console.log('plotline response Error', error.message)
		return false
	}
}


