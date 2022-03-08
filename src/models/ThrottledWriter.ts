import pThrottle from "p-throttle";



export default class ThrottledWriter {


    constructor(throttleInterval: number) {
        const throttle = pThrottle({
            limit: 1,
            interval: 10_000
        });


    }

    private throttledWrite()  {

    }
}

const collections: Map<string, any> = new Map();


function 