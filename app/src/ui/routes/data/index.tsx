import { Route, Switch } from "wouter";
import { DataEmpty, DataRoot } from "./_data.root";
import { DataEntityUpdate } from "./data.$entity.$id";
import { DataEntityCreate } from "./data.$entity.create";
import { DataEntityList } from "./data.$entity.index";
import { DataSchemaEntity } from "./data.schema.$entity";
import { DataSchemaIndex } from "./data.schema.index";

export default function DataRoutes() {
   return (
      <DataRoot>
         <Switch>
            <Route path="/" component={DataEmpty} />
            <Route path="/entity/:entity" component={DataEntityList} />
            <Route path="/entity/:entity/create" component={DataEntityCreate} />
            <Route path="/entity/:entity/edit/:id" component={DataEntityUpdate} />

            <Route path="/schema" nest>
               <Route path="/" component={DataSchemaIndex} />
               <Route path="/entity/:entity/:setting?/:sub?" component={DataSchemaEntity} />
            </Route>
         </Switch>
      </DataRoot>
   );
}
