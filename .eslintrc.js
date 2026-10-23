module.exports = {
	'env': {
		'node': true,
		'commonjs': true,
		'es2021': true
	},
	'root' : true,
	'globals': {
		'Resolvers' : true,
		'Services' : true,
		'require': true, 
		'process': true,
		'fileServices': true,
		'axios':true
	},
	'extends': 'eslint:recommended',
	'overrides': [
	],
	'parserOptions': {
		'ecmaVersion': 'latest'
	},
	'rules': {
		'indent': [
			'error',
			'tab'
		],
		'linebreak-style': [
			'error',
			process.platform === 'win32' ? 'windows' : 'unix'
		],
		'quotes': [
			'error',
			'single'
		],
		'semi': [
			'error',
			'never'
		]
	}
}
