export const sendNotification = async (email: string, message: string): Promise<boolean> => {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
        console.warn("RESEND_API_KEY not set, skipping email notification");
        return false;
    }

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: "Document Processing <noreply@yourdomain.com>",
                to: [email],
                subject: "Document Processing Update",
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Document Processing Update</h2>
            <p>${message}</p>
            <p style="color: #6b7280; font-size: 14px;">
              This is an automated message from the Colombian Document Processing System.
            </p>
          </div>
        `,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Resend API error: ${response.status} - ${errorText}`);
            return false;
        }

        const data = await response.json();
        console.log(`Email sent successfully: ${data.id}`);
        return true;

    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
};
