import { EFSClient, DescribeAccessPointsCommand } from "@aws-sdk/client-efs";
import 'dotenv/config';

const efsClient = new EFSClient({ region: process.env.NEXT_PUBLIC_REGION });

export async function getAccessPointByUserId(userId: string): Promise<string | null> {
  try {
    const command = new DescribeAccessPointsCommand({
      FileSystemId: process.env.EFS_FILE_SYSTEM_ID!,
    });

    const response = await efsClient.send(command);

    // Find access point with matching userId tag
    const accessPoint = response.AccessPoints?.find((ap: any) =>
      ap.Tags?.some((tag: any) => tag.Key === "UserId" && tag.Value === userId)
    );

    if (accessPoint && accessPoint.AccessPointId) {
      console.log(`Found existing access point: ${accessPoint.AccessPointId} for user: ${userId}`);
      return accessPoint.AccessPointId;
    }

    console.log(`No access point found for user: ${userId}`);
    return null;
  } catch (error) {
    console.error("Error getting access point:", error);
    throw error;
  }
}

export async function getAccessPointById(accessPointId: string) {
  try {
    const command = new DescribeAccessPointsCommand({
      AccessPointId: accessPointId,
    });

    const response = await efsClient.send(command);

    if (response.AccessPoints && response.AccessPoints.length > 0) {
      return response.AccessPoints[0];
    }

    return null;
  } catch (error) {
    console.error("Error getting access point by ID:", error);
    throw error;
  }
}
