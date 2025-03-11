"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getOrganizationMembers,
  inviteUserToOrganization,
  isSuperAdmin,
  revokeInvitation,
} from "@/server/actions/organizations";
import { useClerk } from "@clerk/nextjs";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

// Invite form schema
const InviteFormSchema = z.object({
  emailAddress: z.string().email("Please enter a valid email address"),
  role: z.enum(["member", "admin"]),
});

type InviteFormValues = z.infer<typeof InviteFormSchema>;

export function MembersSettings() {
  const [members, setMembers] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [isSuperAdminValue, setIsSuperAdminValue] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();
  const { session } = useClerk();

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(InviteFormSchema),
    defaultValues: {
      emailAddress: "",
      role: "member",
    },
  });

  // Fetch organization members and check permissions
  useEffect(() => {
    async function fetchData() {
      try {
        // Check if user has admin rights
        const superAdminResult = await isSuperAdmin();
        setIsSuperAdminValue(superAdminResult);

        // Get current members
        const result = await getOrganizationMembers({
          limit: 100, // Increase the limit to ensure we get more members
          offset: 0,
        });

        setMembers(result.members);
        setTotalCount(result.totalCount);

        // Determine if the current user has admin access
        // This is true if they are a super admin or if they are an admin in the current org
        const currentUserId = session?.user?.id;

        if (!currentUserId) {
          setHasAdminAccess(superAdminResult);
          return;
        }

        // Find the current user in the members list
        const currentUserRecord = result.members.find(
          (member) => member.clerkId === currentUserId,
        );

        const isOrgAdmin =
          currentUserRecord &&
          (currentUserRecord.role === "admin" ||
            currentUserRecord.role === "superadmin");

        // Set admin access if user is superadmin or organization admin
        setHasAdminAccess(superAdminResult || isOrgAdmin);
      } catch (error) {
        console.error("Error fetching members:", error);
        toast.error("Could not load organization members");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [session?.user?.id]);

  // Handle invite submission
  const onInviteSubmit = async (values: InviteFormValues) => {
    try {
      setIsInviting(true);

      const result = await inviteUserToOrganization({
        emailAddress: values.emailAddress,
        role: values.role,
      });

      toast.success(`Invitation sent to ${values.emailAddress}`);
      form.reset();
      setDialogOpen(false);

      // Refresh the member list
      const newMembersList = await getOrganizationMembers({
        limit: 50,
        offset: 0,
      });

      setMembers(newMembersList.members);
      setTotalCount(newMembersList.totalCount);
    } catch (error) {
      console.error("Error inviting user:", error);

      // Provide more user-friendly error messages based on common scenarios
      let errorMessage = "Failed to send invitation";

      if (error instanceof Error) {
        const errorText = error.message;

        if (errorText.includes("already exists")) {
          errorMessage = "This user is already a member of the organization";
        } else if (errorText.includes("invalid email")) {
          errorMessage = "The email address appears to be invalid";
        } else if (errorText.includes("rate limit")) {
          errorMessage = "Too many invitation attempts. Please try again later";
        } else if (errorText.includes("Clerk API error:")) {
          // Handle Clerk-specific errors with better messaging
          if (
            errorText.includes("Organization role not found") ||
            errorText.includes("role")
          ) {
            errorMessage =
              "There is a configuration issue with roles in your Clerk organization. Contact support for assistance.";
          } else if (errorText.includes("redirect_url must be a")) {
            errorMessage =
              "There's a configuration issue with the invitation system. Please contact support.";
          } else if (
            errorText.includes("already exists") ||
            errorText.includes("already invited")
          ) {
            errorMessage =
              "This user already exists in your organization or has a pending invitation.";
          } else {
            errorMessage = "Failed to send invitation. Please try again later.";
          }
          // Log the full error for debugging
          console.error("Detailed Clerk error:", errorText);
        } else {
          // Use the actual error message but make it more user-friendly
          errorMessage = `Error: ${errorText}`;
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsInviting(false);
    }
  };

  // Handle revoke invitation
  const handleRevokeInvitation = async (
    invitationId: string,
    email: string,
  ) => {
    try {
      await revokeInvitation({ invitationId });
      toast.success(`Invitation to ${email} revoked successfully`);

      // Refresh the member list
      const newMembersList = await getOrganizationMembers({
        limit: 50,
        offset: 0,
      });

      setMembers(newMembersList.members);
      setTotalCount(newMembersList.totalCount);
    } catch (error) {
      console.error("Error revoking invitation:", error);
      toast.error("Failed to revoke invitation");
    }
  };

  // Helper function to format role for display
  const formatRole = (role: string) => {
    switch (role) {
      case "superadmin":
        return { label: "Super Admin", color: "bg-red-100 text-red-800" };
      case "admin":
        return { label: "Admin", color: "bg-blue-100 text-blue-800" };
      case "member":
      default:
        return { label: "Member", color: "bg-gray-100 text-gray-800" };
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-8 w-64" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-96" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Organization Members</CardTitle>
          <CardDescription>
            Manage and invite members to your organization
          </CardDescription>
        </div>
        {hasAdminAccess && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a New Member</DialogTitle>
                <DialogDescription>
                  Send an invitation email to add a new member to your
                  organization.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onInviteSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="emailAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input placeholder="email@example.com" {...field} />
                        </FormControl>
                        <FormDescription>
                          The email address of the person you want to invite
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            {isSuperAdminValue && (
                              <SelectItem value="superadmin">
                                Super Admin
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Access level for the invited user
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isInviting}>
                      {isInviting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Send Invitation
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <div>
              <p className="text-sm text-muted-foreground">
                No members found for this organization
              </p>
            </div>
          </div>
        ) : (
          <div className="">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  {hasAdminAccess && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const role = formatRole(member.role);
                  const isPending = member.status === "pending";
                  const invitationId = isPending ? member.clerkId : null;

                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {isPending ? (
                          <span className="italic text-muted-foreground">
                            Pending...
                          </span>
                        ) : (
                          `${member.firstName} ${member.lastName}`
                        )}
                      </TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <Badge className={role.color}>{role.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {isPending ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-100 text-amber-800"
                          >
                            Pending Invitation
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-green-100 text-green-800"
                          >
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {member.createdAt
                          ? format(new Date(member.createdAt), "MMM d, yyyy")
                          : "Pending"}
                      </TableCell>
                      {hasAdminAccess && (
                        <TableCell className="text-right">
                          {isPending && invitationId && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      handleRevokeInvitation(
                                        invitationId,
                                        member.email,
                                      )
                                    }
                                  >
                                    <XCircle className="h-4 w-4 text-red-500" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Revoke invitation</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {totalCount > members.length && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Showing {members.length} of {totalCount} members
          </div>
        )}
      </CardContent>
    </Card>
  );
}
