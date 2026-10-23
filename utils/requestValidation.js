const Joi = require('joi')

exports.sendProtocolsValidation = async (screenName, sourceFunc, dataToProtocols) => {
	let schema = Joi.object({
		screenName: Joi.string().required(),
		sourceFunc: Joi.string().required(),
		dataToProtocols: Joi.object({
			data: Joi.object().required(),
			config: Joi.object({
				retry: Joi.boolean(),
				await: Joi.boolean()
			}).required()
		}).required()
	})


	// for whatever protocol data is present inside the object, we do the validation
	for (let protocolKey of Object.keys(dataToProtocols)) {
		await schema.validateAsync({ screenName, sourceFunc, dataToProtocols: dataToProtocols[protocolKey] })
	}


	return true
}


exports.makeGotCallValidation = async (params) => {
	let schema = Joi.object({
		screenName: Joi.string().required().allow(''),
		sourceFunc: Joi.string().required(),
		protocol: Joi.string().required(),
		url: Joi.string().required(),
		data: Joi.required(),
		reqHeaders: Joi.object(),
		retryLimit: Joi.number(),
		timeout: Joi.number(),
	})

	await schema.validateAsync(params)

	return true
}