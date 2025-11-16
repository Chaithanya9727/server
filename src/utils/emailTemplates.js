// utils/emailTemplates.js

export const recruiterApprovedTemplate = (name, orgName) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recruiter Account Approved</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f8f9fa;
      padding: 20px;
      color: #333;
    }
    .container {
      background: #fff;
      border-radius: 12px;
      padding: 25px 35px;
      max-width: 600px;
      margin: auto;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    h1 {
      color: #4a3aff;
      margin-bottom: 15px;
    }
    p {
      line-height: 1.6;
      margin: 10px 0;
    }
    .button {
      display: inline-block;
      padding: 10px 18px;
      background-color: #4a3aff;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      margin-top: 20px;
    }
    footer {
      margin-top: 25px;
      font-size: 13px;
      color: #777;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎉 Congratulations ${name}!</h1>
    <p>Your recruiter account for <strong>${orgName}</strong> has been <b>approved</b>.</p>
    <p>You can now access the OneStop Hub Recruiter Dashboard to post opportunities, manage candidates, and collaborate with institutions.</p>
    <a href="${process.env.CLIENT_URL}/login" class="button">Access Recruiter Dashboard</a>
    <footer>
      <p>— The OneStop Hub Admin Team</p>
    </footer>
  </div>
</body>
</html>
`;

export const recruiterRejectedTemplate = (name, orgName) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recruiter Application Rejected</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f8f9fa;
      padding: 20px;
      color: #333;
    }
    .container {
      background: #fff;
      border-radius: 12px;
      padding: 25px 35px;
      max-width: 600px;
      margin: auto;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    h1 {
      color: #d93025;
      margin-bottom: 15px;
    }
    p {
      line-height: 1.6;
      margin: 10px 0;
    }
    footer {
      margin-top: 25px;
      font-size: 13px;
      color: #777;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚠️ Application Update</h1>
    <p>Hello ${name},</p>
    <p>We regret to inform you that your recruiter registration for <strong>${orgName}</strong> has been <b>rejected</b> after review.</p>
    <p>If you believe this was an error or would like to reapply, please contact our support team at <a href="mailto:support@onestophub.com">support@onestophub.com</a>.</p>
    <footer>
      <p>— The OneStop Hub Admin Team</p>
    </footer>
  </div>
</body>
</html>
`;
