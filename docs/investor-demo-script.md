# FundsRoom Investor Demo Script

## How to use this script

This script is designed for a 15- to 20-minute recorded demonstration. The words under **Say** are the lines to speak. The words under **On screen** tell you what to click or show. Speak slowly, pause after important numbers, and let each screen remain visible long enough for the viewer to understand it.

Before recording:

1. Open the deployed application in a full-screen browser window.
2. Keep the browser zoom at 100 percent.
3. Prepare the four demo accounts in a private note so role changes are quick.
4. Start with the login screen and finish on the Sales dashboard.
5. Do not rush through form submissions. The value of the product is visible in the workflow between screens.

---

## 1. Opening: the business problem

**On screen:** Show the login page. Do not move the pointer for the first few seconds.

**Say:**

“Hello, and welcome to FundsRoom.

FundsRoom is a role-based ERP and customer relationship management portal built for a wholesale distribution business. It connects sales, customer relationships, inventory, warehouse work, accounts, business documents, alerts, and reporting in one operational system.

The problem it solves is simple to describe, but expensive for a growing company to ignore. In many small and mid-sized businesses, customer information lives in spreadsheets, stock information lives in a warehouse register, sales documents are prepared separately, and important follow-ups survive only in someone’s memory or chat history.

That separation creates very practical failures. Sales may promise stock that is not available. Warehouse staff may receive urgent requests without context. Accounts may spend time searching for documents. Managers may see totals but not know who sold what, to whom, or why inventory changed.

FundsRoom turns those disconnected activities into one traceable business flow. A customer becomes a relationship, a relationship becomes a sale, a sale becomes a stock movement, and every important event becomes visible to the right team.”

Pause briefly.

“This demonstration will show the product from the perspective of Sales, Warehouse, Accounts, and Administration. The important point is not that every user sees the same dashboard. The important point is that each person sees the information and actions required for their real responsibility.”

---

## 2. Authentication and role-based access

**On screen:** Sign in with the Sales account.

**Say:**

“I will begin as Riya Kapoor from the Sales team.

The application uses authenticated sessions and role-based authorization. The interface changes by role, but permissions are not protected only by hiding buttons. The backend also checks every protected action. If a user attempts an operation outside their responsibility, the API rejects it.

Passwords are stored as secure hashes, sign-in returns a time-limited token, request data is validated before it reaches the database, and business conflicts return clear responses instead of silently corrupting data.”

**On screen:** Allow the Sales overview to load.

---

## 3. Sales overview and operational dashboard

**On screen:** Slowly point to the metric cards, low-stock area, follow-ups, sales chart, sales-by-teammate chart, and recent challans.

**Say:**

“This is the Sales overview. It is designed as a working screen, not a decorative dashboard.

At the top, Sales can immediately see the size of the customer directory, the number of products in the catalogue, and the items that need attention because stock has reached its configured threshold.

The low-stock watch list turns inventory risk into an action before it becomes a failed order. Upcoming follow-ups keep customer commitments visible. Recent challans show the latest sales documents and their current state.

The page refreshes operational data automatically, so the user does not have to reload the entire application to see changing stock, notifications, or sales totals.”

**On screen:** Hover over several daily sales bars. Pause on one tooltip.

**Say:**

“A common weakness in dashboards is that a chart gives a number but hides the business activity behind it. Here, hovering over a daily sales bar exposes the underlying transactions.

For each sale, the tooltip identifies who sold it, which customer and business bought it, what product was sold, the SKU, the quantity, the challan number, and the line value.

This means a manager can move from summary to evidence without leaving the dashboard. The chart is not only saying that revenue happened. It explains how it happened.”

**On screen:** Point to the Sales-by-teammate section.

**Say:**

“The Sales ownership view compares revenue, units, and challan activity by teammate. This can support performance review, territory planning, workload balancing, and incentive design. It also makes ownership explicit: every sale is connected to the person responsible for it.”

---

## 4. Working notification system

**On screen:** Click the notification bell.

**Say:**

“The notification bell is connected to persisted database records; it is not a static visual element.

The system reconciles real business conditions into an inbox. Low-stock products create high-priority alerts. Customer follow-ups that are due soon create reminders. Open customer queries become actionable notifications with their priority.

Each user has an independent read state. I can mark one notification as read or clear the unread state for all of them. If the business condition is resolved—for example, stock is replenished or a query is answered—the related warning is removed. If the same condition returns later, it becomes unread again.

That behavior matters because useful notifications should reflect the current operation, not become a permanent list of stale warnings.”

**On screen:** Mark one notification as read, then close the panel.

---

## 5. Customer relationship management

**On screen:** Open Customers. Use search to find a customer by name or business. Open the customer profile.

**Say:**

“Now I will move from the business summary into the customer relationship workspace.

The customer directory supports quick search across customer name, business name, and mobile number. Search is deliberately debounced, so it feels immediate to the user without sending an unnecessary request on every keystroke.

Each customer record stores contact details, business name, customer category, status, GST information, address, and the next follow-up date. Customers can be classified as retail, wholesale, or distributor, and their relationship state can be tracked as a lead, active customer, or inactive account.

This segmentation gives Sales a more useful view than a flat address book. A lead needs conversion activity. An active wholesale customer may need repeat-order follow-up. An inactive account may need re-engagement.”

**On screen:** Show the Timeline tab.

**Say:**

“The Timeline tab keeps follow-up notes and relationship events together. Instead of depending on one salesperson’s memory, the company retains continuity. If ownership changes, the next teammate can understand what was promised and what should happen next.”

**On screen:** Open Queries.

**Say:**

“The Queries tab is for customer questions and service requests. A query has a subject, full message, priority, status, creation history, and a reply thread.

The distinction between logging and resolving is important. Sales can record an incoming customer query and reply with useful information. Authorized operational roles can resolve it when the issue is actually complete. The history remains visible, so resolution does not erase the conversation.

This turns a customer question from a loose message into an owned, prioritized, auditable task.”

**On screen:** Show a query, its replies, and its resolve state. Do not create unnecessary demo text if good records already exist.

**On screen:** Open Reviews.

**Say:**

“Reviews represent feedback received from the customer about the company’s service. They are not internal staff reviewing the customer. Each review stores a one-to-five-star rating, the customer’s feedback, and its date.

Keeping queries, replies, reviews, and follow-ups beside the customer profile creates a practical CRM history. The team can see not only what a customer purchased, but what they asked, how the company responded, and how the customer felt about the service.”

---

## 6. Product catalogue and inventory visibility

**On screen:** Open Products. Search using part of a product name or SKU.

**Say:**

“The Products workspace gives Sales a clear catalogue view without granting warehouse-only controls.

Each product includes its name, SKU, category, unit price, current stock, minimum stock alert quantity, and warehouse location. The stock status is derived from real values: when current stock reaches or falls below its configured minimum, the product becomes low stock.

The status badges are designed to remain readable at different screen sizes, and the tables preserve alignment instead of compressing important text.”

**On screen:** Select a low-stock or ordinary product and click Request stock.

---

## 7. Sales-to-Warehouse stock request

**On screen:** In the Request stock form, show quantity, urgency, and message fields. Enter a sensible demonstration request, but pause before submitting.

**Say:**

“This is one of the most important cross-team workflows in the product.

Sales can request a specific quantity of a specific product directly from the catalogue. The request includes an urgency level—low, medium, or high—and a written message explaining the business reason.

For example, I can request additional paper stock as high priority because a wholesale customer is preparing a large order. That context is valuable to Warehouse. They are not receiving a vague message saying ‘we need more stock’; they can see exactly what is needed, how much is required, who requested it, when it was requested, and why it matters.”

**On screen:** Submit the request and show the success state or request list.

**Say:**

“The request is now stored in MySQL as a pending business record. It is visible to the Sales user who created it and enters the Warehouse approval queue. Sales cannot approve its own request, and unrelated roles cannot create one.”

---

## 8. Creating a sales challan

**On screen:** Click New challan. Select a customer, add two products if stock allows, and adjust quantities.

**Say:**

“Next, I will create a sales challan.

A challan connects one customer with one or more product lines. The user selects the customer, chooses products, enters quantities, and can add multiple items before saving.

The form prevents invalid quantities and duplicate product lines. When the draft is saved, the system creates a uniquely numbered document without changing stock yet. This draft state is useful because a sale may still be under discussion.”

**On screen:** Save as draft. Open the saved challan.

**Say:**

“The draft can be reviewed, cancelled, or confirmed. Confirmation is intentionally more than changing a label.

Inside one database transaction, the backend locks the challan, loads and locks the required product rows, verifies every requested quantity, and rejects the entire confirmation if even one item would make stock negative.

If stock is sufficient, the system deducts each quantity, creates linked stock-out movement records, stores product and price snapshots on the document, and changes the challan to confirmed.

The transaction is all-or-nothing. The system will not confirm half an order and leave the data in an uncertain state.”

**On screen:** Confirm the challan if the selected quantities are safe.

**Say:**

“The confirmed sale is now reflected in the challan list, inventory, movement history, analytics, and dashboard totals. One action updates the connected operation rather than forcing staff to repeat the same work in several places.”

---

## 9. Business documents and exports

**On screen:** Open Challans. Search for the newly created challan or customer. Download its PDF.

**Say:**

“The Challans workspace supports search by challan number, customer, or business. Status remains visually clear across draft, confirmed, and cancelled records.

Each challan can be downloaded as a PDF document. The PDF is generated from the stored challan and item snapshots, so an older document is not silently rewritten when a product’s current price or name changes later.”

**On screen:** Open the downloaded PDF briefly, then return to the application.

**Say:**

“Accounts and authorized users can also export sales data as CSV. This provides a simple bridge to spreadsheet analysis, reconciliation, external reporting, and audit work without giving Accounts permission to alter warehouse stock or customer conversations.”

**On screen:** Click Export CSV, then return to the overview.

---

## 10. Warehouse portal: focused responsibility

**On screen:** Log out and sign in as the Warehouse user.

**Say:**

“I will now switch to Kabir Shah in Warehouse.

Notice that Warehouse does not receive the Sales and CRM template with a different name at the bottom. The portal is focused on warehouse responsibility: products, stock levels, stock requests, movement history, challans, and operational notes.

Warehouse does not need teammate sales rankings, customer reviews, customer ratings, or customer query management. Removing that noise improves both security and usability. The best role-based system does not merely disable irrelevant buttons—it gives each team a workspace shaped around its actual job.”

**On screen:** Show the Warehouse overview and pending stock-request queue.

**Say:**

“The pending request created by Sales is now visible here with the product, SKU, requested quantity, urgency, author, message, and timestamp.

Warehouse can reject the request with a review note, or approve it. Approval is transaction-safe: the request is locked, checked to ensure it is still pending, the product stock is incremented, an incoming stock movement is recorded, and the request is marked approved with the warehouse reviewer and review time.

That means two warehouse users cannot accidentally approve the same request twice.”

**On screen:** Approve the request. Show the new current-stock value and movement record.

**Say:**

“The request is approved. The product stock has increased by the requested amount, and the audit trail explains exactly why the number changed.

Warehouse can also record an independent supplier receipt by selecting a product, entering the incoming quantity, and writing a reason. Every movement records its type, quantity, user, reference, reason, and timestamp.”

---

## 11. Accounts portal

**On screen:** Log out and sign in as Accounts.

**Say:**

“The Accounts role is intentionally read-oriented.

Accounts can inspect confirmed sales activity, review challans, search documents, download PDFs, and export data. It does not need to alter customer service conversations or receive stock into the warehouse.

This separation supports the principle of least privilege. Every employee receives the access necessary for their responsibility, but not a broad set of powers merely because the data is in the same application.”

**On screen:** Show challan search, a PDF action, and the export action.

---

## 12. Administration and security controls

**On screen:** Log out and sign in as Admin.

**Say:**

“Finally, the Administration role provides operational oversight.

Administration can review the connected business state, manage core records, monitor unresolved issues, and resolve customer queries when appropriate. It does not impersonate the customer by writing customer feedback. Reviews remain feedback received from customers, and query replies remain part of a visible conversation history.

Security is enforced at several layers. Authentication protects private routes. Role middleware protects business actions. Validation rejects malformed input. Parameterized database queries reduce injection risk. Security headers and request-size limits reduce common web attack surfaces. Rate limits constrain repeated API abuse. Database foreign keys and constraints protect relationships and quantity rules.

The application also returns consistent authorization and validation errors. That matters because a secure system should fail clearly and predictably without leaking internal secrets.”

---

## 13. Architecture explanation for technical viewers

**On screen:** Return to a clean dashboard. If editing the video, optionally place the architecture diagram from the README beside the browser capture.

**Say:**

“From an architecture perspective, FundsRoom uses a React and TypeScript frontend, an Express and TypeScript REST API, and a MySQL relational database.

The frontend sends JSON requests with an authenticated bearer token. The API owns validation, permission checks, business rules, document generation, analytics queries, and database transactions. MySQL stores users, customers, CRM events, products, stock movements, challans, item snapshots, stock requests, replies, reviews, and notification state.

This separation is deliberate. The browser never connects directly to the database, and critical business rules do not depend on a hidden button in the interface. They are enforced where all clients must pass: the API and the database.”

---

## 14. Investor value and commercial direction

**On screen:** Show the Sales overview again, preferably with the daily sales chart and low-stock section visible.

**Say:**

“The present project is a focused operational product, but its commercial direction is broader.

The immediate value is reduced operational fragmentation. A company gets one customer history, one view of stock, one challan lifecycle, one movement audit trail, and one reporting surface. That can reduce duplicate entry, missed follow-ups, overselling, delayed stock communication, and time spent reconstructing what happened.

The product can grow in several practical directions.

First, financial operations: tax calculation, discounts, shipping charges, payment status, credit limits, receivables, and accounting integrations.

Second, procurement: suppliers, purchase orders, goods-received notes, reorder suggestions, and approval limits.

Third, warehouse scale: multiple warehouses, bin-level inventory, transfers, barcode scanning, batches, and expiry tracking.

Fourth, customer experience: a customer portal, self-service order history, document downloads, support requests, and delivery tracking.

Fifth, management intelligence: configurable KPIs, margins, product velocity, customer lifetime value, salesperson conversion, demand forecasting, and scheduled reports.

Sixth, enterprise readiness: configurable permissions, audit-event retention, session management, automated backups, monitoring, background jobs, and integration APIs.

The architecture already creates a strong foundation for these additions because customers, products, documents, users, and inventory events are separate but connected business entities.”

---

## 15. Closing statement

**On screen:** Keep the dashboard still. Move the pointer away from important content.

**Say:**

“FundsRoom is not presented as a collection of unrelated screens. It is presented as a working operational chain.

A Sales user understands the customer, creates a document, and requests stock when needed. Warehouse receives that request with context, approves it, and leaves an auditable movement. Accounts retrieves the correct document and export. Administration sees the larger operation. The dashboard explains performance without hiding the transactions beneath the chart.

The result is a system in which responsibility is visible, stock is protected, customer history is preserved, and each team receives a workspace designed for its role.

That is the central idea behind FundsRoom: when the company’s work is connected, the software becomes more than a record keeper. It becomes a shared operational memory.

Thank you for watching.”

---

## Optional 60-second opening for a shorter version

**Say:**

“FundsRoom is a role-based ERP and CRM portal for wholesale operations. It connects customers, queries, reviews, follow-ups, products, inventory, sales challans, warehouse approvals, notifications, PDFs, exports, and analytics in one traceable workflow.

Sales can manage relationships, create a multi-item challan, and request urgent stock with a message. Warehouse receives that request, approves it once, and the system adds stock with an audit movement. Accounts can review and export sales documents without changing operational data. Managers can hover over any sales bar to see who sold what, to which customer, in what quantity, and for what value.

Every role has a focused portal, and permissions are enforced by the backend as well as the interface. FundsRoom replaces disconnected spreadsheets and messages with one shared operational memory.”

## Recording tips

- Aim for 125 to 140 spoken words per minute.
- Leave a one-second pause after every form submission.
- Let each chart tooltip remain visible for at least three seconds.
- Use real-looking business messages instead of typing “test” or “hello.”
- Do not expose passwords in the recording; paste them or cut the sign-in portion.
- Record at 1920 by 1080 when possible.
- Keep browser developer tools, bookmarks, and unrelated tabs out of the frame.
- If a request takes a moment, explain what the backend is checking instead of filling the silence with repeated words.
- Finish on a clean dashboard rather than a modal or login page.
