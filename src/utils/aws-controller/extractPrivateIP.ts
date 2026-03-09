export function getPrivateIp(task: any): string {
  const attachment = task.attachments?.find(
    (att: any) => att.type === "ElasticNetworkInterface"
  );

  if (!attachment) {
    throw new Error("No ENI attachment found");
  }

  const ipDetail = attachment.details?.find(
    (detail: any) => detail.name === "privateIPv4Address"
  );

  if (!ipDetail?.value) {
    throw new Error("Private IP not found");
  }

  return ipDetail.value;
}