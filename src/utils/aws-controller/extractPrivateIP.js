export function getPrivateIp(task) {
    const attachment = task.attachments?.find((att) => att.type === "ElasticNetworkInterface");
    if (!attachment) {
        throw new Error("No ENI attachment found");
    }
    const ipDetail = attachment.details?.find((detail) => detail.name === "privateIPv4Address");
    if (!ipDetail?.value) {
        throw new Error("Private IP not found");
    }
    return ipDetail.value;
}
//# sourceMappingURL=extractPrivateIP.js.map