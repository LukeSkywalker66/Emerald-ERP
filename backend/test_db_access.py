import sys, json
sys.path.insert(0, '/opt/emerald-erp/backend/src')
from database.session import SessionLocal
from models.work_orders import WorkOrder
from models.tickets import Ticket
from sqlalchemy.orm import selectinload

session = SessionLocal()

try:
    allocations = session.query(WorkOrder)\
        .filter(
            WorkOrder.team_id.isnot(None),
            WorkOrder.status.in_(['scheduled', 'in_progress']),
        )\
        .options(
            selectinload(WorkOrder.ticket).selectinload(Ticket.creator),
            selectinload(WorkOrder.team),
            selectinload(WorkOrder.technician),
        ).limit(3).all()
    
    print(f"Found {len(allocations)} allocations")
    
    for wo in allocations:
        print(f"\nWO #{wo.id}:")
        print(f"  Ticket: {wo.ticket.id if wo.ticket else 'None'}")
        if wo.ticket:
            print(f"  connection_details: {wo.ticket.connection_details}")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    session.close()
