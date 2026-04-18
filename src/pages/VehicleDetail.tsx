import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { canEdit } from "@/lib/permissions";

export default function VehicleDetail() {
  const { role } = useAuth();
  const hasEdit = canEdit(role, "vehicles");
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: images = [] } = useQuery({
    queryKey: ["vehicle-images", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_images")
        .select("*")
        .eq("vehicle_id", id!);
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Vehicle deleted");
      navigate("/vehicles");
    },
    onError: () => toast.error("Failed to delete"),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (!vehicle) return <p className="text-destructive">Vehicle not found</p>;

  const info = (label: string, value: any) => (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/vehicles">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-foreground">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h1>
        </div>
        <div className="flex gap-2">
          {hasEdit && (
            <>
              <Button variant="outline" asChild>
                <Link to={`/vehicles/${id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this vehicle record and all
                      associated images.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {images.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Images</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((img) => (
                <img
                  key={img.id}
                  src={img.image_url}
                  alt=""
                  className="w-full h-40 object-cover rounded-md border"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {info("Make", vehicle.make)}
            {info("Model", vehicle.model)}
            {info("Year", vehicle.year)}
            {info("Chassis (VIN)", vehicle.vin)}
            {info("Color", vehicle.color)}
            {info("Mileage", vehicle.mileage?.toLocaleString())}
            {info("Fuel Type", vehicle.fuel_type)}
            {info("Transmission", vehicle.transmission)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing & Status</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {info("Selling Price", `₦${vehicle.price?.toLocaleString()}`)}
            {info("Cost Price", `₦${vehicle.cost_price?.toLocaleString()}`)}
            {info("Status", vehicle.status)}
            {info("Condition", vehicle.condition)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory Info</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {info(
              "Date Arrived",
              vehicle.date_arrived
                ? new Date(vehicle.date_arrived).toLocaleDateString()
                : null
            )}
            {info(
              "Date Stored",
              vehicle.date_stored
                ? new Date(vehicle.date_stored).toLocaleDateString()
                : null
            )}
            {info("Number of Keys", vehicle.num_keys)}
            {info("Source Company", vehicle.source_company)}
          </CardContent>
        </Card>

        {vehicle.description && (
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{vehicle.description}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
