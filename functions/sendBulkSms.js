const { updateOne } = require('new-dynamo-wrapper')
const axios = require('axios')
const qs = require('qs')
const generateRandomNumber = require('random-number')
const { getEnv } = require('./getEnv')

const sendBulkSms = async ({ user, list, amount }) => {
	try {

		var smsSuggestions = findSmsSuggestionsThorughRandomNumber()
		console.log('sms suggestions', smsSuggestions)
		console.log(user.screenName, ' having sms suggestions', smsSuggestions)
		//console.log('In send SMS', list.toString())
		if (smsSuggestions === 'kaleyra') {
			console.log(`${user.screenName} Sending req to kaleyra In try block`)
			await sendSmsThroughKaleyra(user, list, amount)
		} else {
			console.log(`${user.screenName} Sending req to smsStriker In try block`)
			await sendSmsThroughSmsStriker(user, list, amount)
		}
		await Promise.all(list.map(async (item) => {
			await updateOne('my_invites', { userId: user._id, identity: item }, { $set: { screenName: user.screenName, status: 'pending', type: 'sms', createdAt: +new Date(), updatedAt: 0 } })
		}))
		return true
	} catch (error) {
		console.log(`${user.screenName} Inside catch block ,Error getting while calling ${smsSuggestions}`)
		if (smsSuggestions === 'kaleyra') {
			console.log(`${user.screenName} Sending req to smsStriker In catch block`)
			await sendSmsThroughSmsStriker(user, list, amount)
		} else {
			console.log(`${user.screenName} Sending req to kaleyra In catch block`)
			sendSmsThroughKaleyra(user, list, amount)
		}
		await Promise.all(list.map(async (item) => {
			await updateOne('my_invites', { userId: user._id, identity: item }, { $set: { screenName: user.screenName, status: 'pending', type: 'sms', createdAt: +new Date(), updatedAt: 0 } })
		}))
		return true
	}


}

const sendSmsThroughKaleyra = async (user, list, amount) => {
	try {
		console.log(`${user.screenName} Inside sendSmsThrough kaleyra function`)
		var data = qs.stringify({
			'method': 'sms',
			'to': list.toString(),
			'sender': 'ATOTHR',
			'api_key': getEnv('KALEYRA_KEY'),  //Af0845c4c7af240d5635b403773dcc72b
			'template_id': '1107164232448941662',
			'message': `Your friend ${user.screenName} has invited you to play on WT Games. Use code ${user.code} to register and play your first few games for free! Get Rs.${amount} as INSTANT CASH in your wallet and play rummy, fantasy, and carrom to win huge rewards. Download App: https://pf.wt.in/raf24j?rc=${user.code}&c=w`
		})
		console.log('data', data)
		var config = {
			method: 'post',
			url: `https://api-alerts.kaleyra.com/v4/?api_key=${getEnv('KALEYRA_KEY')}`,
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			data: data
		}
		await axios(config).then(function (response) { console.log(JSON.stringify(response.data)) }).catch(function (error) { console.log(error) })
		return true
	} catch (error) {
		console.log('Error occurred in sendSmsThroughKeleyra->', error)
		throw (error)
	}
}
const sendSmsThroughSmsStriker = async (user, list, amount) => {
	try {
		console.log(`${user.screenName} Inside sendSmsThrough smsStriker function`)
		let newList = []
		list.map(x => {
			newList.push(x.replace('+91', ''))
		})
		let baseUrl = getEnv('SMSSTRIKER_URL')
		let data = {
			username: getEnv('SMSSTRIKER_USERNAME'),
			password: getEnv('SMSSTRIKER_PASSWORD'),
			from: 'WTACT',
			to: newList.toString(),
			msg: `Your friend ${user.screenName} has invited you to play on WT Games. Use code ${user.code} to register and play your first few games for free! Get Rs.${amount} as INSTANT CASH in your wallet and play rummy, fantasy, and carrom to win huge rewards. Download App: https://pf.wt.in/raf24j?rc=${user.code}&c=w`,
			type: '1',
			template_id: '1107164232448941662'
		}
		let config = {
			method: 'GET',
			url: baseUrl,
			params: data
		}
		await axios(config).then(function (response) { console.log((response.data)) }).catch(function (error) { console.log(error) })
		return true
	} catch (error) {
		console.log('Error occurred in sendSmsThroughSmsStriker->', error)
		throw (error)
	}
}
const findSmsSuggestionsThorughRandomNumber = () => {
	let options = { min: 1, max: 100, integer: true }
	let randomNumber = generateRandomNumber(options), smsSuggestions
	console.log('random number for Sms Sugesstions', randomNumber)
	let maxValue = getEnv('SMS_MAXVALUE')
	smsSuggestions = (randomNumber <= maxValue) ? 'kaleyra' : 'SmsStriker'
	// smsSuggestions = (randomNumber >= 1 && randomNumber <= 7) ? 'kaleyra' : 'SmsStriker'
	return smsSuggestions
}

exports.sendBulkSms = sendBulkSms