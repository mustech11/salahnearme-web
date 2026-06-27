"use client";

import { useState } from "react";

type Props = {
  businessId: string;
};

export default function BusinessLeadForm({
  businessId,
}: Props) {
  const [loading, setLoading] =
    useState(false);

  const [success, setSuccess] =
    useState(false);

  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    subject: "",
    message: "",
  });

  async function submit() {
    setLoading(true);

    setSuccess(false);

    try {
      const res = await fetch(
        "/api/business-leads/create",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            business_id: businessId,

            ...form,
          }),
        }
      );

      if (res.ok) {
        setSuccess(true);

        setForm({
          customer_name: "",
          customer_email: "",
          customer_phone: "",
          subject: "",
          message: "",
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
      <div className="mb-6">
        <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
          Contact Business
        </div>

        <div className="mt-2 text-3xl font-black text-white">
          Send Enquiry
        </div>
      </div>

      <div className="space-y-4">
        <input
          value={form.customer_name}
          onChange={(e) =>
            setForm({
              ...form,
              customer_name:
                e.target.value,
            })
          }
          placeholder="Your name"
          className="w-full rounded-2xl border border-yellow-500/20 bg-black/30 px-4 py-3 text-white outline-none"
        />

        <input
          value={form.customer_email}
          onChange={(e) =>
            setForm({
              ...form,
              customer_email:
                e.target.value,
            })
          }
          placeholder="Your email"
          className="w-full rounded-2xl border border-yellow-500/20 bg-black/30 px-4 py-3 text-white outline-none"
        />

        <input
          value={form.customer_phone}
          onChange={(e) =>
            setForm({
              ...form,
              customer_phone:
                e.target.value,
            })
          }
          placeholder="Your phone"
          className="w-full rounded-2xl border border-yellow-500/20 bg-black/30 px-4 py-3 text-white outline-none"
        />

        <input
          value={form.subject}
          onChange={(e) =>
            setForm({
              ...form,
              subject:
                e.target.value,
            })
          }
          placeholder="Subject"
          className="w-full rounded-2xl border border-yellow-500/20 bg-black/30 px-4 py-3 text-white outline-none"
        />

        <textarea
          value={form.message}
          onChange={(e) =>
            setForm({
              ...form,
              message:
                e.target.value,
            })
          }
          placeholder="Your message"
          rows={5}
          className="w-full rounded-2xl border border-yellow-500/20 bg-black/30 px-4 py-3 text-white outline-none"
        />

        <button
          onClick={submit}
          disabled={loading}
          className="rounded-2xl bg-yellow-500 px-6 py-3 font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
        >
          {loading
            ? "Sending..."
            : "Send enquiry"}
        </button>

        {success && (
          <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-green-300">
            Enquiry sent successfully.
          </div>
        )}
      </div>
    </div>
  );
}

