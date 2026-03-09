export type sessionRequestType = {
    userId: string,
    projectId?: string,
    projectName?: string
}

export type sessionStopRequest = {
    taskArn: string, 
    privateIp: string,
    sessionId: string
}

export type signupDataType = {
    name: string, 
    password: string, 
    email: string
}