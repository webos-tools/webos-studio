
//const process = require( 'node:process');
const execa = require( 'execa');

 function isElevated() {
	return process.platform === 'win32' ? isAdmin() : true;// isRoot();
}

async function testFltmc() {
	try {
		await execa('fltmc');
		return true;
	} catch {
		return false;
	}
}

 async function isAdmin() {
	if (process.platform !== 'win32') {
		return false;
	}

	try {
		await execa('fsutil', ['dirty', 'query', process.env.systemdrive]);
		return true;
	} catch (error) {
		if (error.code === 'ENOENT') {
			return testFltmc();
		}

		return false;
	}
}
function isRoot() {
	return process.getuid && process.getuid() === 0;
}
module.exports = {
    isElevated: isElevated
  
};