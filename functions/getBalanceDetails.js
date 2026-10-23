exports.calcMoney = async (user, poolDetails) => {
	try {
		console.log(`${user.screenName} - Inside getBalanceDetails function, poolDetails : ${JSON.stringify(poolDetails)}`)
		console.log(user, poolDetails)
		console.log('user: ', user)
		console.log(user.screenName, 'poolDetails.bonusPercentage: ', poolDetails.bonusPercentage)

		if (poolDetails.bonusPercentage === undefined) {
			console.log(user.screenName, 'No bonus percentage found for this poolid: ', poolDetails.poolId)
			return { status: false, message: 'No bonus percentage found', poolDetails }
		}

		let allowedBonus = ((poolDetails.entryFee / 100) * poolDetails.bonusPercentage)

		const { deducted_balance, availableBalance, amountToAdd, entryStatus } = await calculateDeductions(user.screenName, poolDetails.entryFee, allowedBonus, user.extraCash, user.tnx, user.bon, user.win)

		console.log('deducted_balance: ', deducted_balance, 'availableBalance: ', availableBalance, 'amountToAdd: ', amountToAdd, 'entryStatus: ', entryStatus)

		let bonus = 0
		let amount = 0
		if (entryStatus === true) {
			bonus = deducted_balance[0] + deducted_balance[2]
			amount = deducted_balance[1] + deducted_balance[3]
		} else {
			bonus = availableBalance[0]
			amount = availableBalance[1]
		}
		const amountDetails = {
			'bonus': Number(bonus.toFixed(2)),
			'amount': Number(amount.toFixed(2)),
			'amountToAdd': Number(amountToAdd.toFixed(2)),
			'entryStatus': entryStatus,
			'entryFee': Number(poolDetails.entryFee.toFixed(2)),
			'bonusPercentage': poolDetails.bonusPercentage
		}


		return { amountDetails }
	} catch (error) {
		console.log('Error occurred in getBalanceDetails', error)
		throw new Error(error)
	}
}


const calculateDeductions = async (screenName, entryFee, allowedBonus, extraCash, tnx, bon, win) => {

	console.log(screenName, 'entryFee:', entryFee, 'allowedBonus:', allowedBonus, 'extraCash:', extraCash, 'tnx:', tnx, 'bon:', bon, 'win:', win, '***inside calcMoney function***')

	let entryStatus = false
	let deductedMoney = 0
	// ec, tnx, bon, win is the order
	let deducted_balance = [0, 0, 0, 0]
	let moneyNeeded = entryFee
	// bonus(ec+bon) and tnx(tnx+win)
	let availableBalance = [0, 0]
	let amountToAdd = 0

	console.log(screenName, 1, 'entryStatus: ', entryStatus, 'deductedMoney: ', deductedMoney, 'deducted_balance: ', deducted_balance, 'moneyNeeded: ', moneyNeeded)

	// Bonus Calculation if percentage is greater than 0
	if (allowedBonus > 0) {

		// Understanding how much money will be deducted from bonus+extracash buckets and how much will be needed to deduct from deposit+winnings buckets
		if ((extraCash + bon) >= allowedBonus) {
			moneyNeeded = entryFee - allowedBonus
			console.log(screenName, 2, 'entryStatus: ', entryStatus, 'deductedMoney: ', deductedMoney, 'deducted_balance: ', deducted_balance, 'moneyNeeded: ', moneyNeeded)
		} else {
			moneyNeeded = entryFee - (extraCash + bon)
			console.log(screenName, 3, 'entryStatus: ', entryStatus, 'deductedMoney: ', deductedMoney, 'deducted_balance: ', deducted_balance, 'moneyNeeded: ', moneyNeeded)
		}
		// Deductions in bonus priortising extracash bucket first
		if (extraCash - allowedBonus >= 0) {
			deducted_balance[0] = allowedBonus
			entryStatus = true
			console.log(screenName, 4, 'entryStatus: ', entryStatus, 'deductedMoney: ', deductedMoney, 'deducted_balance: ', deducted_balance, 'moneyNeeded: ', moneyNeeded)
		} else {
			deducted_balance[0] = extraCash
			if (bon >= (allowedBonus - extraCash)) {
				deducted_balance[2] = (allowedBonus - extraCash)
				entryStatus = true
				console.log(screenName, 5, 'entryStatus: ', entryStatus, 'deductedMoney: ', deductedMoney, 'deducted_balance: ', deducted_balance, 'moneyNeeded: ', moneyNeeded)
			} else {
				deducted_balance[2] = bon
				entryStatus = true
				console.log(screenName, 6, 'entryStatus: ', entryStatus, 'deductedMoney: ', deductedMoney, 'deducted_balance: ', deducted_balance, 'moneyNeeded: ', moneyNeeded)
			}
		}
	} else {
		entryStatus = true
	}

	// Making sure entry can be given so far
	if (entryStatus == true) {
		if ((tnx + win) >= moneyNeeded) {
			// Deductions in remaining money priortising tnx bucket first
			if ((tnx - moneyNeeded) >= 0) {
				deductedMoney = moneyNeeded
				deducted_balance[1] = moneyNeeded
				entryStatus = true
				console.log(screenName, 7, 'entryStatus: ', entryStatus, 'deductedMoney: ', deductedMoney, 'deducted_balance: ', deducted_balance, 'moneyNeeded: ', moneyNeeded)
			} else {
				deductedMoney = (moneyNeeded - tnx)
				deducted_balance[1] = tnx
				if (deductedMoney <= win) {
					entryStatus = true
					deducted_balance[3] = deductedMoney
					console.log(screenName, 8, 'entryStatus: ', entryStatus, 'deductedMoney: ', deductedMoney, 'deducted_balance: ', deducted_balance, 'moneyNeeded: ', moneyNeeded)
				} else {
					// This wouldnt be happening here as it's being handled in the below else condition, but writing it down just in case.
					entryStatus = false
					console.log(screenName, 9, 'entryStatus: ', entryStatus, 'deductedMoney: ', deductedMoney, 'deducted_balance: ', deducted_balance, 'moneyNeeded: ', moneyNeeded)
				}
			}
		} else {
			// User doesnt have enough money for the pool
			entryStatus = false
			console.log(screenName, 10, 'entryStatus: ', entryStatus, 'deductedMoney: ', deductedMoney, 'deducted_balance: ', deducted_balance, 'moneyNeeded: ', moneyNeeded)
		}
	}

	// Calculating how much money is available and sending those values accordingly in case there's overall insufficient balance
	if (entryStatus === false) {
		let remainingAmo = entryFee
		if (allowedBonus > 0) {
			if ((extraCash + bon) >= allowedBonus) {
				availableBalance[0] = allowedBonus
			} else {
				availableBalance[0] = Number(extraCash + bon)
			}
			remainingAmo = entryFee - availableBalance[0]
			availableBalance[1] = tnx + win
		} else {
			availableBalance[1] = tnx + win
		}
		amountToAdd = remainingAmo - availableBalance[1]
	}
	console.log(screenName, 'entryStatus: ', entryStatus, 'deductedMoney: ', deductedMoney, 'deducted_balance: ', deducted_balance, 'moneyNeeded: ', moneyNeeded, '***returning from calcMoney function!***')
	return { deducted_balance, availableBalance, amountToAdd, entryStatus }
}
