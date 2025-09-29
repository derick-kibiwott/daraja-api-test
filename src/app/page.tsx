"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader } from "lucide-react";
import axios from "axios";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formSchema, FormData } from "@/schemas/mpesa";
import { supabase } from "@/lib/supabase/client";

interface ServerErrorResponse {
  error: string;
}

export default function Page() {
  const [status, setStatus] = useState<
    "idle" | "sending" | "waiting" | "success" | "failed"
  >("idle");

  // State to hold the public_id, which will be used for the subscription
  const [publicId, setPublicId] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phone: "",
      amount: "1",
    },
  });

  // Effect to subscribe to a new publicId
  useEffect(() => {
    // If there is no publicId, or if it has been cleared, do not subscribe
    if (!publicId) return;

    // Use a unique channel name to prevent conflicts
    const channel = supabase
      .channel(`payments-changes-${publicId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "payments",
          filter: `public_id=eq.${publicId}`,
        },
        (payload) => {
          const newStatus = payload.new.status as
            | "idle"
            | "sending"
            | "waiting"
            | "success"
            | "failed";
          console.log("current status ---->", newStatus);

          setStatus(newStatus);

          if (newStatus === "success") {
            toast.success("Payment successful 🎉");
            // Clear publicId from state and localStorage to end subscription
            setPublicId(null);
            localStorage.removeItem("payment_public_id");
          }

          if (newStatus === "failed") {
            toast.error("Payment failed ❌");
            // Clear publicId from state and localStorage to end subscription
            setPublicId(null);
            localStorage.removeItem("payment_public_id");
          }
        }
      )
      .subscribe((status) => {
        console.log("Supabase subscription status:", status);
      });

    // Cleanup function to remove the channel on component unmount or when publicId changes
    return () => {
      supabase.removeChannel(channel);
    };
  }, [publicId]); // The useEffect now depends on the publicId state

  const onSubmit = async (values: FormData) => {
    setStatus("sending");
    try {
      let normalizedPhone = values.phone;
      const amount = parseInt(values.amount);

      if (normalizedPhone.startsWith("0")) {
        normalizedPhone = "254" + normalizedPhone.slice(1);
      } else if (normalizedPhone.startsWith("+254")) {
        normalizedPhone = normalizedPhone.replace("+", "");
      }

      const { data } = await axios.post("/api/stk", {
        phone: normalizedPhone,
        amount,
      });

      if (!data?.public_id) {
        toast.error("Missing payment ID from server");
        setStatus("failed");
        return;
      }

      // Corrected way to pass custom data in signInAnonymously
      const { error: authError } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            public_id: data.public_id,
          },
        },
      });

      if (authError) {
        console.error("Supabase auth error:", authError);
        toast.error("Failed to authenticate session.");
        setStatus("failed");
        return;
      }

      setPublicId(data.public_id);
      localStorage.setItem("payment_public_id", data.public_id);

      toast.success("STK Push sent! Check your phone");
      setStatus("waiting");
    } catch (error: unknown) {
      console.error("STK Push error:", error);

      let errorToastMessage = "Something went wrong";

      // Safely check for AxiosError and extract server message
      if (axios.isAxiosError(error)) {
        // Check if the response exists and has a data object with an 'error' property
        const serverError = error.response?.data as
          | ServerErrorResponse
          | undefined;

        if (serverError?.error) {
          errorToastMessage = serverError.error;
        } else if (error.message) {
          // Fallback to the generic Axios error message
          errorToastMessage = error.message;
        }
      } else if (error instanceof Error) {
        // Handle generic JavaScript errors
        errorToastMessage = error.message;
      }

      toast.error(errorToastMessage);
      setStatus("failed");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg text-gray-700 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">
          STK Push Test
        </h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 0700123456" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Enter amount in KES"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={status === "sending" || status === "waiting"}
              className="w-full flex items-center justify-center"
            >
              {status === "sending" && (
                <>
                  <Loader className="animate-spin mr-2" /> Sending…
                </>
              )}
              {status === "waiting" && (
                <>
                  <Loader className="animate-spin mr-2" /> Waiting for payment…
                </>
              )}
              {status === "idle" && "Send"}
              {status === "success" && "✅ Paid"}
              {status === "failed" && "Retry"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
