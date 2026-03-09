import { EFSClient, CreateAccessPointCommand } from "@aws-sdk/client-efs";
import 'dotenv/config';

const efsClient = new EFSClient({ region: process.env.NEXT_PUBLIC_REGION });

export async function createAccessPoint(userId: string): Promise<string> {
  try {
    const command = new CreateAccessPointCommand({
      FileSystemId: process.env.EFS_FILE_SYSTEM_ID!,
      PosixUser: {
        Uid: 1000,
        Gid: 1000,
      },
      RootDirectory: {
        Path: `/workspace/${userId}`,
        CreationInfo: {
          OwnerUid: 1000,
          OwnerGid: 1000,
          Permissions: "755",
        },
      },
      Tags: [
        {
          Key: "UserId",
          Value: userId,
        },
        {
          Key: "Name",
          Value: `workspace-${userId}`,
        },
      ],
    });

    const response = await efsClient.send(command);

    if (!response.AccessPointId) {
      throw new Error("Failed to create access point");
    }

    console.log(`Created EFS access point: ${response.AccessPointId} for user: ${userId}`);
    
    return response.AccessPointId;
  } catch (error) {
    console.error("Error creating EFS access point:", error);
    throw error;
  }
}
