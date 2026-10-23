const { exec } = require('child_process')
const util = require('util')
// const axios = require('axios')
const { makeGotCall } = require('../functions/makeGotCall')

const stage = (process.env.stage || 'development')

let webhookURL = 'https://chat.googleapis.com/v1/spaces/AAAA0C4yGHI/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=LVuus8AVbe3lR2yqZ-0qkJX6vUY5HaiDc0RJ5KfkfiY'
if (stage === 'production') webhookURL = 'https://chat.googleapis.com/v1/spaces/AAAAY6Nb11w/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=Smo1stjPpNFdUJMKyCVoUgYvil9Vi1AQHw201_TQYZY'


/**
 * Sends message to the Platform Backend Deployments space
 */
const chatWebhook = async (data) => {
	let url = `http://gitlab.corp.hdworks.in/platformbackend/${data.service}/-/tree/${data.branch}`

	let formatString = `Attention <users/all>\n\n*Branch:*\t\t\t${data.branch}\n*Service:*\t\t${data.service}\n*Stage:*\t\t\t${stage}\n*Time:*\t\t\t${data.time}\n*Email:*\t\t\t${data.email}\n\n${url}\n\n*-------- Latest commit details --------*\n\n*Hash:*\t\t\t${data.commit[0]}\n*Committed by:*\t${data.commit[1]} <${data.commit[2]}>\n*Commit date:*\t${data.commit[3]}\n*Message:*\t\t${data.commit[4]}`

	await makeGotCall({ screenName: data.email, sourceFunc: 'deploymentScript', url: webhookURL, protocol: 'chat webhook', data: { 'text': formatString }, reqHeaders: { 'Content-Type': 'application/json; charset=UTF-8' }, timeout: 5000, retryLimit: 1 })
	return true
}


const deploymentScript = async () => {
	try {
		let promisifiedExec = util.promisify(exec)

		// getting the branch name
		let gitBranch = await promisifiedExec('git rev-parse --abbrev-ref HEAD')
			.then(branch => branch.stdout)

		// getting the config email
		let email = await promisifiedExec('git config user.email')
			.then(emailFetch => emailFetch.stdout.trim())

		// getting the service name
		let serviceName = await promisifiedExec('basename `git rev-parse --show-toplevel`')
			.then(servicename => servicename.stdout.split('\n')[0])

		// getting the latest commit details
		let commitDetails = await promisifiedExec('git log -1 --pretty=format:"%H#%cn#%ce#%cd#%s"')
			.then(commit => commit.stdout.split('#'))

		// sending the message to the chat
		await chatWebhook({ branch: gitBranch.replace(/(\r\n|\n|\r)/gm, ''), service: serviceName, time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), email: email || '', commit: commitDetails })
			.then(() => console.log('The chat message was sent successfully'))
			.catch((error) => console.log('Error in sending the chat message', error.message))
	}
	catch (error) {
		console.log(error)
	}
}

deploymentScript()
