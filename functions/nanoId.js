exports.nanoId = async () => {
	let nanoid = await import('nanoid')
	const custAlpha = nanoid.customAlphabet('1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 10)
	return custAlpha()
}