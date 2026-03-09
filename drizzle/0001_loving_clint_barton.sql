CREATE TABLE "cloud-ide-sessions" (
	"sessionId" varchar(255) PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"privateIp" varchar(50) NOT NULL,
	"taskArn" varchar(500) NOT NULL,
	"projectId" varchar(255),
	"projectName" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cloud-ide-users" ALTER COLUMN "password" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "cloud-ide-users" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cloud-ide-users" ALTER COLUMN "accessPointId" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "cloud-ide-users" ALTER COLUMN "accessPointId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cloud-ide-sessions" ADD CONSTRAINT "cloud-ide-sessions_userId_cloud-ide-users_userId_fk" FOREIGN KEY ("userId") REFERENCES "public"."cloud-ide-users"("userId") ON DELETE cascade ON UPDATE no action;