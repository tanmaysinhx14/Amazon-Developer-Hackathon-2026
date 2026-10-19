Frequently Asked Questions
Question: Will hackathon participants get access to the gated Alexa+ developer tools (Category SDK, MCP Toolkit, CLI, or Web Simulator)?

Answer: No. Amazon's Alexa+ Add-on developer tools (Category SDK, MCP Toolkit, CLI, and Web Simulator) are in preview and available to select partners only - there is currently no way for hackathon participants to apply for or gain access. This is called out on Amazon's add-on docs home page, though it's sometimes missing from individual setup-guide pages, which has caused some confusion. You do not need these tools for your submission: build a self-hosted MCP server (or Agent Skill) per the Official Rules, and demo it via your own web-based simulator or front end.

-

Question: How do I request AWS Promotional Credits, and can every team member request their own?

Answer: AWS Promotional Credits ($150) are requested per individual, not per team - every registered participant, including each teammate, can submit their own request via the form linked.

-

Question: How do I avoid running up AWS costs before Judging even starts?

Answer: Judging runs November 9-20, so you don't need Bedrock or other AWS services running continuously until then. Spin resources up only when testing and tear them down afterward (tools like AWS CDK, CloudFormation, or Terraform make this quick). There isn't an official offline emulator for Bedrock, so for early development consider mocking or stubbing the Bedrock calls in your code and only hitting the live API to validate the real integration. Your AWS Promotional Credit can be applied toward this usage.

-

Question: Is there a maximum number of members per team?

Answer: No. The Official Rules don't set a maximum team size - you can enter solo, as a team, or as an organization. If you enter as a team, designate one member as your Representative to submit on the team's behalf.

-

Question: Do I need physical hardware for my track, or can I use a simulator/emulator instead?

Answer: It depends on the track.

Fire TV: an emulator (Android TV Emulator or the Fire TV/Vega simulator) is fine - a physical device isn't required at any stage of submission or judging.
Alexa+: build a self-hosted MCP server or Agent Skill, or a simulated experience - no physical device needed.
Bee: You need either an Apple Watch or Bee device.
Ring: any Ring API, SDK, simulator, or device listed in Ring's developer docs is acceptable (for example, Ring Indoor Cam), and your demo can show either a simulator (like the Ring Developer Playground) or an actual device.
-

Question: Why isn't Developer Mode showing up in the Bee Android app?

Answer: You need to pair a Bee device before Developer Mode becomes available in the Bee app's Settings.

-

Question: My GitHub repo is private - how do I share it with the judging team?

Answer: Add the Amazon and Devpost reviewers as collaborators before the submission deadline (in your repo: Settings > Collaborators > Add people).

Amazon reviewers: knmeiss, giolaq, anishamalde, mosesroth, emersonsklar.

Devpost: testing@devpost.com.

Each invitee has to accept, and invitations expire after 7 days, so add reviewers around when you submit rather than weeks in advance, and re-send if an earlier invite lapsed. Public repos need no extra steps beyond an open-source license file.

-

Question: Can I submit a GitLab (or other non-GitHub) repository?

Answer: No - the Official Rules require your code repository to be hosted on GitHub specifically. Please host on GitHub instead (public with an open-source license file, or private and shared with the reviewers listed in the private-repo FAQ above).

-

Question: Is there a country restriction on participating in the hackathon?

Answer: The hackathon is open to individuals worldwide except residents of a country, state, province, or territory where U.S. or local law prohibits participating or receiving a prize - the Official Rules specifically name Brazil, Quebec, Russia, Crimea, Cuba, Iran, and North Korea, plus any other country comprehensively sanctioned by the U.S. Treasury's Office of Foreign Assets Control (OFAC).

-

Question: Can I use licensed or Creative-Commons footage in my demo video?

Answer: Any third-party media you use needs to be content you have the rights to use, and your video should primarily demonstrate your own project. Properly-attributed, brief supporting or background footage is typically fine - check with us on the specifics (how much of the video it makes up and how it's used) before finalizing.

-

Question: For the Alexa+ track, does my repo need to be hosted or deployed for judging, and what counts as a 'significant update' to an existing project?

Answer: A locally runnable public repo plus your demo video is enough - judges can download, build, and test it themselves, so hosting isn't required. A new conversational feature that brings new functionality to an existing app can count as a significant update - focus your demo on a clear before-and-after so judges can see what changed.

- 

Question: Does the hackathon provide a certificate of participation?

Answer: No, the hackathon doesn't issue participation certificates.

-

Question: Does my MCP server need to stay live after I submit? Is the $150 AWS credit per person or per team, and what's a cheap way to host it?

Answer: Your MCP server doesn't need to stay running after you submit. The $150 AWS Promotional Credit is per person, so every teammate can request their own. For cheap or free hosting, AWS Lambda is a good fit for an MCP server during a hackathon - it only runs (and costs) while it's actually handling a request, and typical usage falls within the AWS free tier.

-

Question: Can a third-party app get its own Bee API app_id, and do API tokens expire or have usage limits?

Answer: Not currently - you'll need to use the app_id provided rather than generating your own, and there's no supported workflow yet for non-developer-mode users or hosted third-party integrations. Tokens don't currently expire, and there's no API usage limit.

-

Question: For the Alexa+ track, can I demo my self-hosted MCP server through a web page that acts as a real MCP client, instead of a device?

Answer: Yes. A web page that acts as an actual MCP client (sending initialize, tools-list, and tools-call requests over Streamable HTTP) satisfies the requirement - this is the simulated-experience path the Resources page points to, since there's no way for any participant to connect a self-hosted MCP server to a real Alexa+ device or developer console (that tooling is select-partners-only). Showing an existing AI assistant app calling the same server is a nice bonus, but not required.

-